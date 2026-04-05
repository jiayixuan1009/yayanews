const db = require('@yayanews/database');
console.log('KEYS in @yayanews/database:', Object.keys(db));
const queries = require('./apps/web/.next/server/app/[lang]/page.js');
console.log('Queries module:', queries);
