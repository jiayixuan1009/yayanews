import { WebSocketServer, WebSocket } from 'ws';
import * as redis from 'redis';

// ExtWebSocket to store custom properties like isAlive
interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 3001;
const wss = new WebSocketServer({ port: PORT });

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

  ws.send(JSON.stringify({ type: 'connected' }));
  
  ws.on('close', () => console.log('WS Client disconnected'));
});

wss.on('close', () => clearInterval(interval));

console.log(`WebSocket Gateway is listening on ws://localhost:${PORT}`);
