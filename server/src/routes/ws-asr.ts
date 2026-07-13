/**
 * 浏览器 ↔ 本服务的 ASR WebSocket 代理（/ws/asr）。
 * 浏览器发：二进制帧 = 16k/16bit/mono PCM 分包；文本帧 = {"type":"end"}。
 * 本服务发：AsrServerMessage（JSON）。
 */
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AsrClientMessage, AsrServerMessage } from '@interview/shared';
import { VolcAsrSession } from '../asr/volc-client.js';

export function createAsrWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', handleConnection);
  return wss;
}

function handleConnection(browser: WebSocket, _req: IncomingMessage): void {
  console.log('[ws-asr] browser connected');
  let upstreamReady = false;
  let ended = false;
  const pendingAudio: Buffer[] = [];

  const send = (msg: AsrServerMessage) => {
    if (browser.readyState === WebSocket.OPEN) browser.send(JSON.stringify(msg));
  };

  const upstream = new VolcAsrSession({
    onReady: () => {
      upstreamReady = true;
      for (const chunk of pendingAudio) upstream.sendAudio(chunk);
      pendingAudio.length = 0;
      if (ended) upstream.end();
      send({ type: 'ready' });
    },
    onResult: (payload, isFinal) => {
      send({ type: 'result', payload, isFinal });
      if (isFinal) {
        // 最终包已回传，会话完成，关闭两侧
        upstream.close();
        browser.close(1000, 'asr session finished');
      }
    },
    onError: (message, code) => {
      send({ type: 'error', code, message });
      upstream.close();
      browser.close(1011, 'asr upstream error');
    },
    onClose: () => {
      send({ type: 'closed' });
    },
  });

  browser.on('message', (data: Buffer, isBinary) => {
    if (isBinary) {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (upstreamReady) upstream.sendAudio(chunk);
      else pendingAudio.push(chunk);
      return;
    }
    try {
      const msg = JSON.parse(data.toString()) as AsrClientMessage;
      if (msg.type === 'end') {
        ended = true;
        if (upstreamReady) upstream.end();
      }
    } catch {
      // 忽略无法解析的控制消息
    }
  });

  browser.on('close', () => {
    console.log('[ws-asr] browser disconnected');
    upstream.close();
  });

  browser.on('error', () => upstream.close());
}
