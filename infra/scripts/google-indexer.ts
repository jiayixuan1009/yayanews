import 'dotenv/config';
import { queryAll } from '@yayanews/database';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

function getServiceAccountCredentials() {
  const envPath = process.env.ENV_FILE_PATH || path.resolve(process.cwd(), '.env');
  let envFile = '';
  try {
    envFile = fs.readFileSync(envPath, 'utf8');
  } catch (err) {}

  if (process.env.GA4_CREDENTIALS_BASE64) {
      return JSON.parse(Buffer.from(process.env.GA4_CREDENTIALS_BASE64, 'base64').toString('utf8'));
  }
  
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  // Look for GA4_CREDENTIALS_BASE64 natively in file if dotenv failed
  const b64Match = envFile.match(/GA4_CREDENTIALS_BASE64=([A-Za-z0-9+/=]+)/);
  if (b64Match) {
      return JSON.parse(Buffer.from(b64Match[1], 'base64').toString('utf8'));
  }

  // Look for raw JSON block just in case
  const jsonMatch = envFile.match(/{[\s\S]*?"client_email"[\s\S]*?}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Could not find Google Service Account JSON in .env");
}

function titleToSlug(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u00c0-\u024f\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/, '');
}

function encodeFlashSlug(flash: { id: number; title: string; published_at: Date }): string {
    const slug = titleToSlug(flash.title);
    if (slug) return `${slug}-${flash.id}`;
    
    // Fallback
    const dtStr = flash.published_at.toISOString();
    let cleaned = dtStr.replace(/[-T:Z.\s]/g, '');
    const yyyymmddhh = cleaned.slice(0, 10);
    const paddedId = String(flash.id).padStart(4, '0');
    return `${yyyymmddhh}${paddedId}`;
}

const BASE_URL = 'https://yayanews.cryptooptiontool.com';

async function main() {
  console.log('Starting Google Indexing Proactive Ping...');
  
  const credentials = getServiceAccountCredentials();
  
  const privateKey = credentials.private_key?.replace(/\\n/g, '\n');

  console.log('Authenticating with Google API...', credentials.client_email);
  if (!privateKey) {
     console.error("FATAL: private_key is missing or undefined! Keys found:", Object.keys(credentials));
     process.exit(1);
  }

  const jwtClient = new google.auth.JWT({
    email: credentials.client_email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/indexing']
  });

  await jwtClient.authorize();
  console.log('Authentication successful.');
  
  // Get 5 newest articles less than 24 hours old
  console.log('Querying latest articles...');
  const resArt = await queryAll(`
    SELECT slug FROM articles 
    WHERE status='published' 
      AND published_at > NOW() - INTERVAL '24 HOURS'
    ORDER BY published_at DESC LIMIT 5
  `);
  
  // Get 5 newest flash news less than 24 hours old
  console.log('Querying latest flashes...');
  const resFlash = await queryAll(`
    SELECT id, title, published_at FROM flash_news 
    WHERE published_at > NOW() - INTERVAL '24 HOURS'
    ORDER BY published_at DESC LIMIT 10
  `);

  const urlsToPush: string[] = [];
  
  for (const row of resArt as any[]) {
      urlsToPush.push(`${BASE_URL}/zh/article/${row.slug}`);
      urlsToPush.push(`${BASE_URL}/en/article/${row.slug}`);
  }

  for (const row of resFlash as any[]) {
      const slug = encodeFlashSlug(row);
      urlsToPush.push(`${BASE_URL}/zh/flash/${slug}`);
      urlsToPush.push(`${BASE_URL}/en/flash/${slug}`);
  }

  console.log(`Prepared ${urlsToPush.length} URLs for Indexing Push.`);

  if (process.argv.includes('--dry-run')) {
      console.log('Dry run enabled. Exiting before push.');
      console.log(urlsToPush);
      process.exit(0);
  }

  const indexing = google.indexing({ version: 'v3', auth: jwtClient });

  for (const url of urlsToPush) {
    try {
      console.log(`Pinging Google for: ${url}`);
      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });
      console.log(`SUCCESS: ${url} -> ${response.status}`);
    } catch (err: any) {
      console.error(`ERROR pushing ${url}:`, err?.response?.data || err.message);
    }
    // simple pacing
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log("Job complete.");
  process.exit(0);
}

main().catch(console.error);
