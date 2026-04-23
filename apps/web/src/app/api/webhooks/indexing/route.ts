import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { log as baseLog } from '@/lib/logger';

const log = baseLog.child({ route: '/api/webhooks/indexing' });
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yayanews.cryptooptiontool.com';

function getServiceAccountCredentials() {
  if (process.env.GA4_CREDENTIALS_BASE64) {
      return JSON.parse(Buffer.from(process.env.GA4_CREDENTIALS_BASE64, 'base64').toString('utf8'));
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  return null;
}

function getWebhookSecret(): string | null {
  const secret = process.env.INDEXING_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

export async function POST(req: Request) {
  try {
    const webhookSecret = getWebhookSecret();
    if (!webhookSecret) {
      log.error('INDEXING_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret misconfigured' }, { status: 500 });
    }

    // 1. Verify Authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const urlsToPush: string[] = Array.isArray(body.urls) ? body.urls : (body.url ? [body.url] : []);

    if (urlsToPush.length === 0) {
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }

    // 2. Load Credentials
    const credentials = getServiceAccountCredentials();
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      log.error('google service account credentials missing');
      return NextResponse.json({ error: 'Credentials misconfigured' }, { status: 500 });
    }

    const privateKey = credentials.private_key.replace(/\\n/g, '\n');

    // 3. Authenticate
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/indexing']
    });

    await jwtClient.authorize();
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });

    // 4. Ping Google
    const results = [];
    for (let path of urlsToPush) {
      // Ensure it's absolute
      const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
      
      try {
        const response = await indexing.urlNotifications.publish({
          requestBody: {
            url: fullUrl,
            type: 'URL_UPDATED',
          },
        });
        results.push({ url: fullUrl, status: response.status, data: response.data });
      } catch (err: any) {
        log.error({ err: err?.response?.data || err?.message, url: fullUrl }, 'indexing push failed');
        results.push({ url: fullUrl, status: err?.response?.status || 500, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    log.error({ err: error }, 'webhook error');
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
