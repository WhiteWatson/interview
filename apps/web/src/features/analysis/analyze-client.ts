/**
 * 结果流式客户端（POST + fetch stream，EventSource 不支持 POST）。
 * 按消息类型分流：语音消息 → /api/analyze（面试答题建议）；
 * 拍照消息 → /api/solve（算法题解法思路）。两者共用同一套 SSE 协议与缓存。
 */
import type { AnalyzeEvent, AnalyzeRequest, SolveRequest } from '@interview/shared';
import { useAppStore } from '@/store';

const inflight = new Set<string>();

export function ensureAnalysis(messageId: string): void {
  const store = useAppStore.getState();
  const existing = store.analysis[messageId];
  // 已完成或正在流式中：直接复用缓存
  if (existing && existing.status !== 'error') return;
  if (inflight.has(messageId)) return;

  const message = store.messages.find((m) => m.id === messageId);
  if (!message) return;

  inflight.add(messageId);
  store.updateAnalysis(messageId, { status: 'streaming', content: '', error: undefined });

  const request =
    message.kind === 'photo'
      ? streamSSE(messageId, '/api/solve', { image: message.imageDataUrl } satisfies SolveRequest)
      : streamSSE(messageId, '/api/analyze', {
          question: message.text,
          // 带上此前最多 5 条语音消息作为上下文（图片消息无文本，跳过）
          context: store.messages
            .slice(Math.max(0, store.messages.indexOf(message) - 5), store.messages.indexOf(message))
            .filter((m): m is Extract<typeof m, { kind: 'speech' }> => m.kind === 'speech')
            .map((m) => m.text),
        } satisfies AnalyzeRequest);

  void request.finally(() => inflight.delete(messageId));
}

async function streamSSE(
  messageId: string,
  url: string,
  body: AnalyzeRequest | SolveRequest,
): Promise<void> {
  const store = useAppStore.getState;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      throw new Error(`请求失败 (HTTP ${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以空行分隔
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6)) as AnalyzeEvent;
        if (event.type === 'delta') {
          store().appendAnalysisDelta(messageId, event.text);
        } else if (event.type === 'done') {
          store().updateAnalysis(messageId, { status: 'done' });
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
    }
    // 流结束但未收到 done（连接中断）：有内容则视为完成，否则报错
    const entry = store().analysis[messageId];
    if (entry?.status === 'streaming') {
      if (entry.content) store().updateAnalysis(messageId, { status: 'done' });
      else throw new Error('连接中断，未收到任何内容');
    }
  } catch (err) {
    store().updateAnalysis(messageId, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
