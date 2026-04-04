const Redis = require('ioredis');
const r = new Redis('redis://:Jia1009re@127.0.0.1:6379/0');
async function check() {
  const high = await r.llen('rq:queue:yayanews:articles:high');
  const d = await r.llen('rq:queue:yayanews:articles:default');
  const low = await r.llen('rq:queue:yayanews:articles:low');
  console.log(`High: ${high}, Default: ${d}, Low: ${low}`);
  process.exit(0);
}
check();
