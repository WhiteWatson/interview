/**
 * POST /api/analyze —— 面试问题分析，SSE 流式返回。
 * 请求体：AnalyzeRequest；事件流：AnalyzeEvent（data: JSON 每行一个事件）。
 */
import type { Request, Response } from 'express';
import type { AnalyzeEvent, AnalyzeRequest } from '@interview/shared';
import { interviewAnalyst } from '../agent/agents/interview-analyst.js';
import { runAgent } from '../agent/runner.js';
import type { ChatMessage } from '../agent/types.js';

export async function handleAnalyze(req: Request, res: Response): Promise<void> {
  const { question, context } = (req.body ?? {}) as Partial<AnalyzeRequest>;
  if (!question?.trim()) {
    res.status(400).json({ error: 'question 不能为空' });
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

  const userContent =
    context?.length
      ? `此前对话片段（供参考）：\n${context.map((c) => `- ${c}`).join('\n')}\n\n面试官刚刚的提问：${question}`
      : `面试官刚刚的提问：${question}`;
  const messages: ChatMessage[] = [{ role: 'user', content: userContent }];

  try {
    await runAgent(interviewAnalyst, messages, {
      signal: abort.signal,
      onToken: (text) => sendEvent({ type: 'delta', text }),
    });
    sendEvent({ type: 'done' });
  } catch (err) {
    if (!abort.signal.aborted) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[analyze] failed:', message);
      sendEvent({ type: 'error', message });
    }
  } finally {
    res.end();
  }
}
