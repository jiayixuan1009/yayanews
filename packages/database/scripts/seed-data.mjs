import pkg from 'pg';

const { Pool } = pkg;

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedData() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Seed] DATABASE_URL is required.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  
  try {
    console.log('[Seed] Connecting to PostgreSQL to seed dummy data...');

    const tags = [
      ['比特币', 'bitcoin'], ['以太坊', 'ethereum'], ['A股', 'a-stock'],
      ['美联储', 'fed'], ['黄金', 'gold'], ['原油', 'oil'],
      ['DeFi', 'defi'], ['期货', 'futures'], ['IPO', 'ipo'], ['AI', 'ai'],
    ];
    
    // Insert Tags
    for (const [name, slug] of tags) {
      await pool.query(
        'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, slug]
      );
    }

    const arts = [
      { t: '比特币突破8万美元：机构资金持续涌入推动加密市场', s: 'bitcoin-breaks-80k', sum: '比特币价格突破80,000美元关口，创历史新高。', c: '<p>比特币在周一亚洲交易时段突破80,000美元大关。</p><h2>机构资金持续流入</h2><p>过去一周数字资产投资产品净流入达到28亿美元。</p>', cat: 2, tp: 'deep', tags: ['bitcoin', 'ethereum', 'defi'], h: '0 hours' },
      { t: 'A股三大指数集体高开，科技板块领涨', s: 'a-shares-tech-rally', sum: '沪指高开0.8%，AI算力概念股表现活跃。', c: '<p>A股三大指数集体高开，科技板块全线走强。</p><h2>市场热点</h2><p>AI算力板块持续活跃，多家龙头涨停。</p>', cat: 1, tp: 'standard', tags: ['a-stock', 'ai', 'ipo'], h: '3 hours' },
      { t: '黄金价格突破3000美元，避险需求激增', s: 'gold-breaks-3000', sum: '国际金价首次突破3000美元/盎司。', c: '<p>国际现货黄金突破3000美元/盎司心理关口。</p><h2>多重因素驱动</h2><p>地缘政治紧张、降息预期、央行增持黄金储备。</p>', cat: 3, tp: 'standard', tags: ['gold', 'fed'], h: '6 hours' },
      { t: '以太坊Pectra升级在即，质押收益预期提升', s: 'ethereum-pectra-upgrade', sum: 'Pectra升级将于下月激活，提升网络效率。', c: '<p>以太坊Pectra升级完成测试网验证。</p><h2>升级亮点</h2><p>包括账户抽象、验证者合并等关键功能。</p>', cat: 2, tp: 'standard', tags: ['ethereum', 'defi'], h: '9 hours' },
      { t: '原油价格因地缘政治升温大涨5%', s: 'oil-geopolitical-surge', sum: 'WTI原油收涨5.2%至72美元/桶。', c: '<p>受中东地缘政治紧张影响，原油大幅上涨。</p><h2>供应风险</h2><p>市场担忧霍尔木兹海峡运输安全。</p>', cat: 3, tp: 'standard', tags: ['oil', 'futures'], h: '12 hours' },
      { t: '美联储会议纪要释放鸽派信号，市场预期6月降息', s: 'fed-dovish-minutes', sum: '多数委员支持年内降息。', c: '<p>美联储会议纪要显示多数FOMC委员支持今年放松货币政策。</p><h2>市场反应</h2><p>美股三大指数全线上涨，标普500创新高。</p>', cat: 1, tp: 'deep', tags: ['fed', 'a-stock'], h: '18 hours' }
    ];

    const artIds = [];
    for (const a of arts) {
      const res = await pool.query(`
        INSERT INTO articles (title, slug, summary, content, category_id, author, status, article_type, published_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'YayaNews', 'published', $6, NOW() - $7::interval, NOW() - $7::interval, NOW() - $7::interval)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id
      `, [a.t, a.s, a.sum, a.c, a.cat, a.tp, a.h]);
      
      if (res.rows.length > 0) {
        const articleId = res.rows[0].id;
        artIds.push(articleId);
        
        for (const tagSlug of a.tags) {
          const tagRes = await pool.query('SELECT id FROM tags WHERE slug = $1', [tagSlug]);
          if (tagRes.rows.length > 0) {
            await pool.query(
              'INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2) ON CONFLICT (article_id, tag_id) DO NOTHING',
              [articleId, tagRes.rows[0].id]
            );
          }
        }
      }
    }
    console.log(`[Seed] ${artIds.length} articles`);

    const fl = [
      ['BTC突破84000美元，24H涨幅2.3%', '比特币短线突破84000美元。', 2, 'high', '5 minutes'],
      ['上证指数开盘涨0.6%，报3420点', 'A股三大指数高开。', 1, 'normal', '30 minutes'],
      ['黄金现货突破3010美元，再创新高', '国际现货黄金续创新高。', 3, 'high', '60 minutes'],
      ['ETH突破3800美元，Pectra升级利好', '以太坊价格突破3800美元。', 2, 'normal', '90 minutes'],
      ['原油主力合约涨停', '国内原油期货触及涨停板。', 3, 'urgent', '120 minutes'],
      ['央行：保持流动性合理充裕', '央行将继续实施稳健货币政策。', 1, 'normal', '150 minutes'],
      ['Solana DEX日交易量破50亿美元', 'Solana生态DeFi持续火热。', 2, 'normal', '180 minutes'],
      ['沪深300涨幅扩大至1.2%', '午后A股持续走强。', 1, 'normal', '240 minutes'],
      ['螺纹钢期货主力涨近3%', '黑色系期货全线走强。', 3, 'normal', '300 minutes'],
      ['比特币ETF今日净流入8.5亿美元', '美国BTC ETF连续第5日正流入。', 2, 'high', '360 minutes'],
    ];

    for (const [t, c, cat, imp, m] of fl) {
      await pool.query(`
        INSERT INTO flash_news (title, content, category_id, importance, published_at, lang)
        VALUES ($1, $2, $3, $4, NOW() - $5::interval, 'zh')
      `, [t, c, cat, imp, m]);
    }
    console.log(`[Seed] ${fl.length} flash news`);

    const topicsToInsert = [
      ['比特币2026牛市追踪', 'btc-2026-bull', '追踪2026年比特币牛市行情'],
      ['A股AI算力主线', 'a-stock-ai-computing', 'AI算力板块深度解析'],
      ['全球央行利率动态', 'global-central-bank-rates', '全球主要央行货币政策动向'],
    ];
    for (const [t, s, d] of topicsToInsert) {
      await pool.query('INSERT INTO topics (title, slug, description) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING', [t, s, d]);
    }

    if (artIds.length >= 6) {
      const taRes = await Promise.all([
        pool.query('SELECT id FROM topics ORDER BY id ASC LIMIT 3')
      ]);
      const topicIds = taRes[0].rows.map(r => r.id);
      
      if (topicIds.length === 3) {
        const topicRelations = [
          [topicIds[0], artIds[0], 1], [topicIds[0], artIds[3], 2],
          [topicIds[1], artIds[1], 1], [topicIds[1], artIds[5], 2],
          [topicIds[2], artIds[2], 1], [topicIds[2], artIds[5], 2]
        ];
        
        for (const [tid, ai, so] of topicRelations) {
          await pool.query(
            'INSERT INTO topic_articles (topic_id, article_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (topic_id, article_id) DO NOTHING',
            [tid, ai, so]
          );
        }
      }
    }
    console.log('[Seed] topics + relations done');
    console.log('[Seed] Complete!');
  } catch (err) {
    console.error('[Seed] Failed to seed data:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();
