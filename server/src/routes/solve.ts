/**
 * POST /api/solve —— 拍照解算法题，SSE 流式返回。
 * 请求体：SolveRequest（题目图片 data URL）；事件流：AnalyzeEvent。
 */
import type { Request, Response } from 'express';
import type { AnalyzeEvent, SolveRequest } from '@interview/shared';
import { algoSolver } from '../agent/agents/algo-solver.js';
import { runAgent } from '../agent/runner.js';
import type { ChatMessage } from '../agent/types.js';

/** 只接受 data URL 形式的图片，避免服务端被诱导去 fetch 任意外部 URL */
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export async function handleSolve(req: Request, res: Response): Promise<void> {
  const { image, note } = (req.body ?? {}) as Partial<SolveRequest>;
  if (!image || !DATA_URL_RE.test(image)) {
    res.status(400).json({ error: 'image 必须是 png/jpeg/webp 的 base64 data URL' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event: AnalyzeEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // 客户端断开（关闭结果页/刷新）时中止对模型的请求
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        {
          type: 'text',
          text: note?.trim()
            ? `请解这道算法题。补充要求：${note.trim()}`
            : '请解这道算法题。',
        },
      ],
    },
  ];

  try {
    await runAgent(algoSolver, messages, {
      signal: abort.signal,
      onToken: (text) => sendEvent({ type: 'delta', text }),
    });
    sendEvent({ type: 'done' });
  } catch (err) {
    if (!abort.signal.aborted) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[solve] failed:', message);
      sendEvent({ type: 'error', message });
    }
  } finally {
    res.end();
  }
}
