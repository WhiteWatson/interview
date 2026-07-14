import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { env } from './config/env.js';
import { handleAnalyze } from './routes/analyze.js';
import { handleSolve } from './routes/solve.js';
import { createAsrWss } from './routes/ws-asr.js';

const app = express();
// 题目图片以 base64 data URL 提交，需要放宽 body 上限（前端已压缩到 ~1280px）
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analyze', handleAnalyze);
app.post('/api/solve', handleSolve);

// 生产环境：同源托管前端静态产物（apps/web/dist），使 /api 与 /ws 无需跨域/代理
const webDist = join(dirname(fileURLToPath(import.meta.url)), '../../apps/web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(webDist, 'index.html'));
  });
}

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
