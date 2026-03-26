import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'yayanews.db'));
db.pragma('journal_mode = WAL');

const tags = [
  ['比特币','bitcoin'],['以太坊','ethereum'],['A股','a-stock'],
  ['美联储','fed'],['黄金','gold'],['原油','oil'],
  ['DeFi','defi'],['期货','futures'],['IPO','ipo'],['AI','ai'],
];
const insTag = db.prepare('INSERT OR IGNORE INTO tags (name,slug) VALUES (?,?)');
tags.forEach(([n,s]) => insTag.run(n,s));

const insArt = db.prepare(`INSERT OR IGNORE INTO articles
  (title,slug,summary,content,category_id,author,status,article_type,published_at,created_at,updated_at)
  VALUES (?,?,?,?,?,'YayaNews','published',?,datetime('now',?),datetime('now',?),datetime('now',?))`);
const insAT = db.prepare('INSERT OR IGNORE INTO article_tags (article_id,tag_id) VALUES (?,?)');

const arts = [
  {t:'比特币突破8万美元：机构资金持续涌入推动加密市场',s:'bitcoin-breaks-80k',sum:'比特币价格突破80,000美元关口，创历史新高。',c:'<p>比特币在周一亚洲交易时段突破80,000美元大关。</p><h2>机构资金持续流入</h2><p>过去一周数字资产投资产品净流入达到28亿美元。</p><h2>ETF效应持续</h2><p>比特币现货ETF累计净流入已超过500亿美元。</p><h2>市场展望</h2><p>多位分析师预计比特币年底前有望触及10万美元。</p>',cat:2,tp:'deep',tags:[1,2,7],h:'-0 hours'},
  {t:'A股三大指数集体高开，科技板块领涨',s:'a-shares-tech-rally',sum:'沪指高开0.8%，AI算力概念股表现活跃。',c:'<p>A股三大指数集体高开，科技板块全线走强。</p><h2>市场热点</h2><p>AI算力板块持续活跃，多家龙头涨停。</p><h2>资金面</h2><p>北向资金净流入超60亿元。</p>',cat:1,tp:'standard',tags:[3,10,9],h:'-3 hours'},
  {t:'黄金价格突破3000美元，避险需求激增',s:'gold-breaks-3000',sum:'国际金价首次突破3000美元/盎司。',c:'<p>国际现货黄金突破3000美元/盎司心理关口。</p><h2>多重因素驱动</h2><p>地缘政治紧张、降息预期、央行增持黄金储备。</p><h2>投资建议</h2><p>可关注黄金ETF以及黄金矿业股。</p>',cat:3,tp:'standard',tags:[5,4],h:'-6 hours'},
  {t:'以太坊Pectra升级在即，质押收益预期提升',s:'ethereum-pectra-upgrade',sum:'Pectra升级将于下月激活，提升网络效率。',c:'<p>以太坊Pectra升级完成测试网验证。</p><h2>升级亮点</h2><p>包括账户抽象、验证者合并等关键功能。</p><h2>市场影响</h2><p>ETH短线上涨5%，Layer2板块走强。</p>',cat:2,tp:'standard',tags:[2,7],h:'-9 hours'},
  {t:'原油价格因地缘政治升温大涨5%',s:'oil-geopolitical-surge',sum:'WTI原油收涨5.2%至72美元/桶。',c:'<p>受中东地缘政治紧张影响，原油大幅上涨。</p><h2>供应风险</h2><p>市场担忧霍尔木兹海峡运输安全。</p><h2>国内影响</h2><p>利好原油、PTA等期货品种。</p>',cat:3,tp:'standard',tags:[6,8],h:'-12 hours'},
  {t:'美联储会议纪要释放鸽派信号，市场预期6月降息',s:'fed-dovish-minutes',sum:'多数委员支持年内降息。',c:'<p>美联储会议纪要显示多数FOMC委员支持今年放松货币政策。</p><h2>市场反应</h2><p>美股三大指数全线上涨，标普500创新高。</p><h2>对A股影响</h2><p>有利于外资回流A股。</p>',cat:1,tp:'deep',tags:[4,3],h:'-18 hours'},
];

const artIds = [];
arts.forEach(a => {
  const r = insArt.run(a.t,a.s,a.sum,a.c,a.cat,a.tp,a.h,a.h,a.h);
  artIds.push(Number(r.lastInsertRowid));
  a.tags.forEach(tid => insAT.run(Number(r.lastInsertRowid), tid));
});
console.log(`[Seed] ${arts.length} articles`);

const insFlash = db.prepare(`INSERT INTO flash_news (title,content,category_id,importance,published_at)
  VALUES (?,?,?,?,datetime('now',?))`);
const fl = [
  ['BTC突破84000美元，24H涨幅2.3%','比特币短线突破84000美元。',2,'high','-5 minutes'],
  ['上证指数开盘涨0.6%，报3420点','A股三大指数高开。',1,'normal','-30 minutes'],
  ['黄金现货突破3010美元，再创新高','国际现货黄金续创新高。',3,'high','-60 minutes'],
  ['ETH突破3800美元，Pectra升级利好','以太坊价格突破3800美元。',2,'normal','-90 minutes'],
  ['原油主力合约涨停','国内原油期货触及涨停板。',3,'urgent','-120 minutes'],
  ['央行：保持流动性合理充裕','央行将继续实施稳健货币政策。',1,'normal','-150 minutes'],
  ['Solana DEX日交易量破50亿美元','Solana生态DeFi持续火热。',2,'normal','-180 minutes'],
  ['沪深300涨幅扩大至1.2%','午后A股持续走强。',1,'normal','-240 minutes'],
  ['螺纹钢期货主力涨近3%','黑色系期货全线走强。',3,'normal','-300 minutes'],
  ['比特币ETF今日净流入8.5亿美元','美国BTC ETF连续第5日正流入。',2,'high','-360 minutes'],
];
fl.forEach(([t,c,cat,imp,m]) => insFlash.run(t,c,cat,imp,m));
console.log(`[Seed] ${fl.length} flash news`);

const insTopic = db.prepare('INSERT OR IGNORE INTO topics (title,slug,description) VALUES (?,?,?)');
[
  ['比特币2026牛市追踪','btc-2026-bull','追踪2026年比特币牛市行情'],
  ['A股AI算力主线','a-stock-ai-computing','AI算力板块深度解析'],
  ['全球央行利率动态','global-central-bank-rates','全球主要央行货币政策动向'],
].forEach(([t,s,d]) => insTopic.run(t,s,d));

const insTA = db.prepare('INSERT OR IGNORE INTO topic_articles (topic_id,article_id,sort_order) VALUES (?,?,?)');
if (artIds.length >= 6) {
  [[1,0,1],[1,3,2],[2,1,1],[2,5,2],[3,2,1],[3,5,2]].forEach(([tid,ai,so]) => insTA.run(tid,artIds[ai],so));
}
console.log('[Seed] topics + relations done');

db.close();
console.log('[Seed] Complete!');
