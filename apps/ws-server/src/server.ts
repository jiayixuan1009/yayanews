import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { URL } from 'url';
import * as redis from 'redis';

// ExtWebSocket to store custom properties like isAlive
interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 3001;

// --- Auth / origin configuration -------------------------------------------
// WS_ALLOWED_ORIGINS: comma-separated list of exact Origin header values
//   (e.g. "https://yayanews.com,https://www.yayanews.com"). When unset,
//   origin checks are skipped (backward compatible).
// WS_AUTH_TOKEN: optional shared secret. When set, clients must connect with
//   ?token=<value>. When unset, no token is required.
const ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const REQUIRED_TOKEN = process.env.WS_AUTH_TOKEN || '';

function verifyClient(
  info: { origin: string; req: IncomingMessage; secure: boolean },
  cb: (res: boolean, code?: number, message?: string) => void
): void {
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = info.origin || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`[ws] rejected connection: bad origin "${origin}"`);
      cb(false, 403, 'forbidden origin');
      return;
    }
  }

  if (REQUIRED_TOKEN) {
    try {
      const host = info.req.headers.host || 'localhost';
      const reqUrl = new URL(info.req.url || '/', `http://${host}`);
      const token = reqUrl.searchParams.get('token') || '';
      if (token !== REQUIRED_TOKEN) {
        console.warn('[ws] rejected connection: missing/invalid token');
        cb(false, 401, 'unauthorized');
        return;
      }
    } catch {
      cb(false, 400, 'bad request');
      return;
    }
  }

  cb(true);
}

const wss = new WebSocketServer({ port: PORT, verifyClient });

// Utilize process.env.REDIS_URL, fallback to localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const subscriber = redis.createClient({
  url: redisUrl,
});

subscriber.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  try {
    await subscriber.connect();
    console.log(`Connected to Redis server at ${redisUrl}`);

    await subscriber.pSubscribe('*:new:*', (message, channel) => {
      console.log(`Broadcast: ${channel}`);
      
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ channel, payload: JSON.parse(message) }));
        }
      });
    });
  } catch (err) {
    console.error('Failed to initialize Redis subscription:', err);
  }
})();

const interval = setInterval(() => {
  wss.clients.forEach((client) => {
    const ws = client as ExtWebSocket;
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', (ws: ExtWebSocket) => {
  ws.isAlive = true;
  console.log('WS Client connected');

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // This gateway is broadcast-only; reject any inbound payload to prevent
  // clients being used as an amplifier or relay.
  ws.on('message', () => {
    try {
      ws.close(1003, 'client messages not accepted');
    } catch {
      /* ignore */
    }
  });

  ws.send(JSON.stringify({ type: 'connected' }));

  ws.on('close', () => console.log('WS Client disconnected'));
});

wss.on('close', () => clearInterval(interval));

console.log(
  `WebSocket Gateway is listening on ws://localhost:${PORT} ` +
    `(origin check: ${ALLOWED_ORIGINS.length ? 'on' : 'off'}, ` +
    `token check: ${REQUIRED_TOKEN ? 'on' : 'off'})`
);
