const https = require('https');

https.get('https://yayanews.cryptooptiontool.com/zh/topics', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const matches = [...data.matchAll(/<img[^>]*src=[\"']([^\"']+)[\"']/g)];
    const urls = matches.map(m => m[1]);
    console.log("FOUND IMAGES:", urls.slice(0, 5));
  });
}).on('error', (e) => {
  console.error("HTTP GET ERROR:", e);
});
