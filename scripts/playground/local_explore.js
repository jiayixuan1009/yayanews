const { PrismaClient } = require('./apps/admin/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.article.findMany({
    where: { topicId: null, tickers: { not: null, not: '' } },
    select: { tickers: true }
  });
  console.log(`Analyzing ${articles.length} unassigned articles...`);

  const counter = {};
  for (const a of articles) {
    if(!a.tickers) continue;
    const tList = a.tickers.replace(/[\"\[\]]/g,'').split(',');
    for (const t of tList) {
      const v = t.trim().toUpperCase();
      if(v.length > 1) counter[v] = (counter[v] || 0) + 1;
    }
  }

  const sorted = Object.entries(counter).sort((a,b) => b[1] - a[1]).slice(0, 30);
  console.log('Top 30 Potential Keywords:');
  sorted.forEach(s => console.log(`${s[0]}: ${s[1]} articles`));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
