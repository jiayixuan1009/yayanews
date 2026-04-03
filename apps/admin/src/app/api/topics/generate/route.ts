import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryGet } from '@yayanews/database';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow sufficient time for the AI calls to complete (Vercel max config)

const GLOBAL_BLACKLIST = new Set([
  '比特币', '以太坊', '美股', '美联储', '加密货币', '区块链', 
  '黄金', '原油', '纳斯达克', '标普500', '美国经济', '中国经济',
  '马斯克', '鲍威尔', '币安', 'A股', '港股', '外汇', '期权',
  'bitcoin', 'ethereum', 'crypto', 'fed', 'gold', 'oil', 'us-stocks'
]);

async function callLLM(prompt: string): Promise<any> {
  const providers = [
    {
      name: 'primary',
      apiKey: process.env.LLM_API_KEY || '',
      baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.fans/v1/chat/completions',
      model: process.env.LLM_MODEL || 'deepseek-chat',
    },
    {
      name: 'fallback',
      apiKey: process.env.LLM_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.LLM_FALLBACK_BASE_URL ? `${process.env.LLM_FALLBACK_BASE_URL}/chat/completions` : 'https://api.deepseek.com/v1/chat/completions',
      model: process.env.LLM_FALLBACK_MODEL || 'deepseek-chat',
    },
  ].filter(p => p.apiKey);

  if (providers.length === 0) {
    throw new Error('No LLM API key configured (LLM_API_KEY or LLM_FALLBACK_API_KEY).');
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const url = provider.baseUrl.includes('/chat/completions')
        ? provider.baseUrl
        : `${provider.baseUrl}/chat/completions`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `你是一个资深财经内容架构师。你的任务是将散乱的新闻分组为特定的"突发事件/重要专题"。
如果你认为提供的新闻资讯内容属于泛泛而谈的宏观分析（如"行情解读"或"以太坊价格分析"或"个股日常波动"），请回答 JSON 字段 "is_event": false。
只有当这些新闻围绕某个特定的、具体的、会持续发展或者有确切终局的现实特定动作与事件时（例如"美联储2026连续降息"或"英伟达发布下一代AI芯片"或"MtGox门头沟巨额抛售"），才回答 "is_event": true 并生定如下 JSON 格式：
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
            { role: 'user', content: prompt }
          ],
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`[${provider.name}] HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const json = await res.json();
      return JSON.parse(json.choices[0].message.content);
    } catch (err: any) {
      lastError = err;
      console.warn(`LLM [${provider.name}] failed: ${err?.message}, trying next...`);
      continue;
    }
  }

  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const logs: string[] = [];
    const createdTopics: any[] = [];

    const sql = `
      WITH tag_counts AS (
        SELECT 
          t.name as tag_name,
          COUNT(a.id) as article_count
        FROM articles a
        JOIN article_tags at ON a.id = at.article_id
        JOIN tags t ON at.tag_id = t.id
        WHERE a.status = 'published' AND a.published_at >= NOW() - INTERVAL '30 days'
        GROUP BY t.id, t.name
      )
      SELECT tag_name, article_count::int FROM tag_counts 
      WHERE article_count >= 15
      ORDER BY article_count DESC;
    `;

    logs.push("🔍 执行 30 天高潜标签全网筛查...");
    const records = await queryAll<{ tag_name: string, article_count: number }>(sql);
    const candidates = records.filter(r => 
      r.tag_name && r.tag_name.length > 1 && 
      !GLOBAL_BLACKLIST.has(r.tag_name) && !GLOBAL_BLACKLIST.has(r.tag_name.toLowerCase())
    ).slice(0, 2); // MVP limit to 2 tags to strictly prevent 60s Nginx Gateway Timeouts

    logs.push(`🔍 捕获到 ${candidates.length} 个非黑名单高频热门 Tag（Top 2）。`);

    for (const candidate of candidates) {
      logs.push(`\n🔬 剖析候选 Tag: [${candidate.tag_name}] (近30天关联 ${candidate.article_count} 篇文章)`);

      const arts = await queryAll<{ id: number, title: string, summary: string }>(`
        SELECT a.id, a.title, a.summary 
        FROM articles a
        JOIN article_tags at ON a.id = at.article_id
        JOIN tags t ON t.id = at.tag_id
        WHERE t.name = $1 AND a.status = 'published'
        ORDER BY a.published_at DESC LIMIT 6
      `, [candidate.tag_name]);

      if (arts.length < 3) {
        logs.push(`⚠️ 有效正文样本不足，跳过评估。`);
        continue;
      }

      const artsTexts = arts.map((a, i) => `【报道${i+1}】标题: ${a.title}\n摘要: ${a.summary || '无'}`).join('\n\n');
      const prompt = `这里是当前全网围绕打上了标签 [${candidate.tag_name}] 的近期重点新闻抽样：\n\n${artsTexts}`;

      logs.push(`🧠 正在请求模型结构化判别...`);
      let llmResult;
      try {
        llmResult = await callLLM(prompt);
      } catch (err: any) {
        logs.push(`❌ 模型交互异常抛回，跳过此执行组: ${err?.message}`);
        continue;
      }

      if (!llmResult.is_event) {
        logs.push('🛑 模型判定被驳回: 过于碎片化泛化的概念，不可形成专题结构。');
        continue;
      }

      const exists = await queryGet<{id: number}>(`SELECT id FROM topics WHERE slug = $1`, [llmResult.slug]);
      if (exists) {
        logs.push(`⚠️ 模型产出的 Slug [${llmResult.slug}] 实则已存在此案 (ID: ${exists.id})，跳过生成。`);
        continue;
      }

      const cat = await queryGet<{id: number}>(`SELECT id FROM categories WHERE slug = $1`, [llmResult.category_slug]);
      
      const insertSql = `
        INSERT INTO topics (slug, title, name_zh, name_en, description, description_zh, description_en, status, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
        RETURNING id
      `;
      const res = await queryAll<{id: number}>(insertSql, [
        llmResult.slug,
        llmResult.topic_name_zh, 
        llmResult.topic_name_zh, 
        llmResult.topic_name_en, 
        llmResult.description_zh,
        llmResult.description_zh, 
        llmResult.description_en, 
        cat?.id || null
      ]);

      const newTopicId = res[0].id;
      logs.push(`✅ 专题提案组建写入成功！已沉睡在草稿箱 (系统新 ID: ${newTopicId})`);

      // ⭐ CRITICAL STEP 2: Automatic Article Association
      logs.push(`🔄 正在自动回源追踪并划编历史文章资源...`);
      const updateRes = await queryAll<{updated: number}>(
        `WITH target_articles AS (
           SELECT a.id FROM articles a
           JOIN article_tags at ON a.id = at.article_id
           JOIN tags t ON at.tag_id = t.id
           WHERE t.name = $1 AND a.topic_id IS NULL AND a.status = 'published'
         )
         UPDATE articles 
         SET topic_id = $2 
         WHERE id IN (SELECT id FROM target_articles)
         RETURNING id`, 
         [candidate.tag_name, newTopicId]
      );

      logs.push(`📚 成功将 [${updateRes.length}] 篇归属地尚为空白的该事件文章平移关联进了此新专题！`);
      createdTopics.push({
        id: newTopicId,
        slug: llmResult.slug,
        name_zh: llmResult.topic_name_zh,
        articlesAssigned: updateRes.length
      });
    }

    return NextResponse.json({ success: true, logs, createdTopics });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
