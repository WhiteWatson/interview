import { createServer } from 'node:http';
import express from 'express';
import { env } from './config/env.js';
import { handleAnalyze } from './routes/analyze.js';
import { createAsrWss } from './routes/ws-asr.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analyze', handleAnalyze);

const server = createServer(app);
const asrWss = createAsrWss();

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/ws/asr') {
    asrWss.handleUpgrade(req, socket, head, (ws) => {
      asrWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});
