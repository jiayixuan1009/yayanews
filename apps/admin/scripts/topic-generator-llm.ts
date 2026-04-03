import { queryAll, queryGet } from '@yayanews/database';
import * as fs from 'fs';

const GLOBAL_BLACKLIST = new Set([
  '比特币', '以太坊', '美股', '美联储', '加密货币', '区块链', 
  '黄金', '原油', '纳斯达克', '标普500', '美国经济', '中国经济',
  '马斯克', '鲍威尔', '币安', 'A股', '港股', '外汇', '期权',
  'bitcoin', 'ethereum', 'crypto', 'fed', 'gold', 'oil'
]);

async function callLLM(prompt: string): Promise<any> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('Missing LLM_API_KEY in .env');
  }

  // 使用系统默认/自定义的大模型直连，这里以兼容标准的 openai 格式作为调用基座
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // 或者替换为您的生产低成本模型
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是一个资深财经内容架构师。你的任务是将松散的新闻分组为特定的"突发事件专题"。如果提供的内容属于泛泛而谈的宏观分析（如"以太坊价格预测"或"美联储缩表总体影响"），请回答 JSON 字段 "is_event": false。只有提供的内容明确围绕某个具体的、有结局期许的现实特定动作或事件时（例如"美联储2026降息50个基点"或"苹果发布首款MR设备"），才能回答 "is_event": true 并生定如下 JSON 格式：
{
  "is_event": true,
  "topic_name_zh": "中文专题名(<=15汉字)",
  "topic_name_en": "English Topic Name",
  "description_zh": "关于该事件详述(>=50汉字)",
  "description_en": "English description(>=50 chars)",
  "slug": "url-friendly-slug-with-date", // MUST contain year/action, eg: fed-rate-cut-2026
  "category_slug": "crypto" // select loosely one from [crypto, us-stocks, derivatives, forex, bonds]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('LLM 请求失败:', txt);
    return null;
  }

  const json = await res.json();
  try {
    return JSON.parse(json.choices[0].message.content);
  } catch (e) {
    console.error('JSON Parse failed for LLM result', json.choices[0].message.content);
    return null;
  }
}

async function run() {
  console.log('🤖 启动 YayaNews M2 阶段：事件 LLM 辨识引擎...');

  const sql = `
    WITH tag_counts AS (
      SELECT 
        t.name as tag_name,
        COUNT(a.id) as article_count,
        MIN(a.published_at) as first_seen,
        MAX(a.published_at) as last_seen
      FROM articles a
      JOIN article_tags at ON a.id = at.article_id
      JOIN tags t ON at.tag_id = t.id
      WHERE a.status = 'published' AND a.published_at >= NOW() - INTERVAL '30 days'
      GROUP BY t.name
    )
    SELECT tag_name, article_count::int FROM tag_counts 
    WHERE article_count >= 15
    ORDER BY article_count DESC;
  `;

  const records = await queryAll<{ tag_name: string, article_count: number }>(sql);
  const candidates = records.filter(r => 
    r.tag_name && r.tag_name.length > 1 && 
    !GLOBAL_BLACKLIST.has(r.tag_name) && !GLOBAL_BLACKLIST.has(r.tag_name.toLowerCase())
  ).slice(0, 5); // 针对前 5 高频执行 MVP 测试

  console.log(`📡 提取了 ${candidates.length} 个候选高频 Tag 展开 LLM 质询分析...`);

  for (const candidate of candidates) {
    console.log(`\n---------------------------------`);
    console.log(`🔬 正在深剖分析 Tag: [${candidate.tag_name}] (近30天关联 ${candidate.article_count} 篇文章)`);

    // 拉取前 6 篇该 tag 对应的文章标题与摘要
    const arts = await queryAll<{ title: string, summary: string }>(`
      SELECT a.title, a.summary 
      FROM articles a
      JOIN article_tags at ON a.id = at.article_id
      JOIN tags t ON t.id = at.tag_id
      WHERE t.name = $1 AND a.status = 'published'
      ORDER BY a.published_at DESC LIMIT 6
    `, [candidate.tag_name]);

    if (arts.length < 3) continue;

    const artsTexts = arts.map((a, i) => `【文献${i+1}】标题: ${a.title}\n摘要: ${a.summary || '无'}`).join('\n\n');
    const prompt = `这里是打上了 [${candidate.tag_name}] 标签的近期新闻抽样资料：\n\n${artsTexts}`;

    console.log(`⏳ 连接模型判断能否成专题...`);
    const llmResult = await callLLM(prompt);

    if (!llmResult) {
      console.log('❌ 模型调用出错或者未返回标准格式，跳过。');
      continue;
    }

    if (!llmResult.is_event) {
      console.log('🛑 模型判断: [无效]，这只是泛滥的概念或宽泛指代，不具有独立事件追踪价值。');
      continue;
    }

    console.log(`✨ 引擎通过！识别出一个全新的重大持续事件！`);
    console.log(`📂 名称: ${llmResult.topic_name_zh} (${llmResult.topic_name_en})`);
    console.log(`🔗 Slug: ${llmResult.slug}`);
    console.log(`📝 简介: ${llmResult.description_zh.slice(0, 30)}...`);

    // 入库前的重复性审核
    const exists = await queryGet<{id: number}>(`SELECT id FROM topics WHERE slug = $1`, [llmResult.slug]);
    if (exists) {
      console.log(`⚠️ 专题 Slug [${llmResult.slug}] 已经存在数据库 (ID: ${exists.id})，跳过插入。`);
    } else {
      // 获得 Category ID
      const cat = await queryGet<{id: number}>(`SELECT id FROM categories WHERE slug = $1`, [llmResult.category_slug]);
      
      const insertSql = `
        INSERT INTO topics (slug, title, name_zh, name_en, description, description_zh, description_en, status, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
        RETURNING id
      `;
      const res = await queryAll(insertSql, [
        llmResult.slug,
        llmResult.topic_name_zh, // 冗余存入老版 title
        llmResult.topic_name_zh, // name_zh
        llmResult.topic_name_en, // name_en
        llmResult.description_zh, // 冗余存入老版 description
        llmResult.description_zh, // description_zh
        llmResult.description_en, // description_en
        cat?.id || null
      ]);
      console.log(`✅ 入库成功！已作为 Pending(draft) 提案静卧在 CMS 等待审批。(新 ID: ${res[0].id})`);
    }
  }

  console.log('\n🎉 MVP 质询执行完毕。您可以去 CMS 后台查看「草稿/待批」的专题候选队列了！');
  process.exit(0);
}

run();
