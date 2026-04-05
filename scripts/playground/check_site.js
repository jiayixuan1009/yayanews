const https = require('https');
https.get('https://yayanews.cryptooptiontool.com/zh', (res) => {
  console.log('STATUS:', res.statusCode);
}).on('error', (e) => console.log('ERROR:', e.message));
