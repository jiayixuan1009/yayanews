const https = require('https');
https.get('https://yayanews.cryptooptiontool.com/admin', (res) => {
  console.log('ADMIN STATUS:', res.statusCode);
}).on('error', (e) => console.log('ERROR:', e.message));
