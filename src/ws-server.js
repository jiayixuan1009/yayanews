const { WebSocketServer } = require('ws');
const redis = require('redis');

const PORT = process.env.WS_PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

const subscriber = redis.createClient({
  url: 'redis://localhost:6379'
});

subscriber.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
  await subscriber.connect();
  console.log('Connected to Redis server');

  await subscriber.pSubscribe('*:new:*', (message, channel) => {
    console.log(`Broadcast: ${channel}`);
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ channel, payload: JSON.parse(message) }));
      }
    });
  });
})();

wss.on('connection', (ws) => {
  console.log('WS Client connected');
  ws.send(JSON.stringify({ type: 'connected' }));
  ws.on('close', () => console.log('WS Client disconnected'));
});

console.log(`WebSocket Gateway is listening on ws://localhost:${PORT}`);
