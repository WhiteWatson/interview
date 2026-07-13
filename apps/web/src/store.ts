import { create } from 'zustand';
import type { AsrResultPayload } from '@interview/shared';

export interface Message {
  /** 以分句 start_time 作为稳定 id */
  id: string;
  text: string;
}

export interface AnalysisEntry {
  status: 'streaming' | 'done' | 'error';
  content: string;
  error?: string;
}

export type RecordingStatus = 'idle' | 'connecting' | 'recording' | 'stopping';

interface AppState {
  status: RecordingStatus;
  /** 当前录音会话 id，用作消息 id 前缀（每次开始录音更新，避免跨会话 start_time 撞车） */
  sessionId: string;
  messages: Message[];
  /** 未判停分句的实时转写 */
  partial: string;
  asrError: string | null;

  /** 按消息 id 缓存的分析结果 */
  analysis: Record<string, AnalysisEntry>;
  /** 当前全屏结果页对应的消息 id；null = 关闭 */
  openAnalysisId: string | null;

  setStatus: (s: RecordingStatus) => void;
  /** 开始一次新的录音会话：换 sessionId 并清空临时转写 */
  newSession: () => void;
  setAsrError: (e: string | null) => void;
  applyAsrResult: (payload: AsrResultPayload) => void;
  clearTranscript: () => void;

  openAnalysis: (id: string) => void;
  closeAnalysis: () => void;
  updateAnalysis: (id: string, entry: Partial<AnalysisEntry>) => void;
  appendAnalysisDelta: (id: string, text: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'idle',
  sessionId: Date.now().toString(36),
  messages: [],
  partial: '',
  asrError: null,
  analysis: {},
  openAnalysisId: null,

  setStatus: (status) => set({ status }),
  newSession: () => set({ sessionId: Date.now().toString(36), partial: '', asrError: null }),
  setAsrError: (asrError) => set({ asrError }),

  /**
   * result_type=full：每次响应都携带会话内全部分句，
   * 直接以响应为准重建 messages（definite）与 partial（非 definite）。
   * 注意与既有消息合并：跨会话（多次录音）时保留旧消息。
   */
  applyAsrResult: (payload) =>
    set((state) => {
      const utterances = payload.result?.utterances;
      if (!utterances) {
        // 无分句信息时把整体 text 当作临时转写
        const text = payload.result?.text ?? '';
        return text ? { partial: text } : {};
      }
      const sessionPrefix = state.sessionId;
      const definite = utterances
        .filter((u) => u.definite && u.text.trim())
        .map((u) => ({ id: `${sessionPrefix}-${u.start_time}`, text: u.text }));
      const partial = utterances
        .filter((u) => !u.definite)
        .map((u) => u.text)
        .join('');
      // 会话内消息全量替换，会话外（历史录音）的保留
      const others = state.messages.filter((m) => !m.id.startsWith(`${sessionPrefix}-`));
      return { messages: [...others, ...definite], partial };
    }),

  clearTranscript: () => set({ messages: [], partial: '', asrError: null }),

  openAnalysis: (openAnalysisId) => set({ openAnalysisId }),
  closeAnalysis: () => set({ openAnalysisId: null }),
  updateAnalysis: (id, entry) =>
    set((state) => {
      const prev = state.analysis[id] ?? { status: 'streaming' as const, content: '' };
      return { analysis: { ...state.analysis, [id]: { ...prev, ...entry } } };
    }),
  appendAnalysisDelta: (id, text) =>
    set((state) => {
      const prev = state.analysis[id] ?? { status: 'streaming' as const, content: '' };
      return { analysis: { ...state.analysis, [id]: { ...prev, content: prev.content + text } } };
    }),
}));
