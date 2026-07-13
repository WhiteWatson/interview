/**
 * /api/analyze 的 SSE 客户端（POST + fetch stream，EventSource 不支持 POST）。
 * 结果写入 store 的 analysis 缓存；同一消息 id 不重复请求。
 */
import type { AnalyzeEvent, AnalyzeRequest } from '@interview/shared';
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

  // 带上此前最多 5 条消息作为上下文
  const idx = store.messages.indexOf(message);
  const context = store.messages.slice(Math.max(0, idx - 5), idx).map((m) => m.text);

  inflight.add(messageId);
  store.updateAnalysis(messageId, { status: 'streaming', content: '', error: undefined });
  void streamAnalyze(messageId, { question: message.text, context }).finally(() =>
    inflight.delete(messageId),
  );
}

async function streamAnalyze(messageId: string, body: AnalyzeRequest): Promise<void> {
  const store = useAppStore.getState;
  try {
    const res = await fetch('/api/analyze', {
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
