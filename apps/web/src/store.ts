import { create } from 'zustand';
import type { AsrResultPayload } from '@interview/shared';

/** 语音转写出来的一句话 */
export interface SpeechMessage {
  /** 以分句 start_time 作为稳定 id */
  id: string;
  kind: 'speech';
  text: string;
}

/** 拍照上传的算法题 */
export interface PhotoMessage {
  id: string;
  kind: 'photo';
  /** 压缩后的 data URL */
  imageDataUrl: string;
}

export type Message = SpeechMessage | PhotoMessage;

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
  /** 追加一条拍照消息，返回其 id */
  addPhoto: (imageDataUrl: string) => string;

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
   * result_type=single（增量）：每包只回传当前分句。
   * 采用追加式——新出现的 definite 分句 append 为消息（按 start_time 去重），
   * 非 definite 文本作为实时 partial。避免全量重建，成本恒定、不随时长增长。
   */
  applyAsrResult: (payload) =>
    set((state) => {
      const utterances = payload.result?.utterances;
      if (!utterances || utterances.length === 0) {
        // 无分句信息时把整体 text 当作临时转写
        const text = payload.result?.text ?? '';
        return text ? { partial: text } : {};
      }
      const prefix = state.sessionId;
      const existingIds = new Set(state.messages.map((m) => m.id));
      const appended: Message[] = [];
      let partial = '';
      for (const u of utterances) {
        if (u.definite && u.text.trim()) {
          const id = `${prefix}-${u.start_time}`;
          if (!existingIds.has(id)) {
            appended.push({ id, kind: 'speech', text: u.text });
            existingIds.add(id);
          }
        } else if (u.text) {
          partial += u.text;
        }
      }
      return {
        messages: appended.length ? [...state.messages, ...appended] : state.messages,
        partial,
      };
    }),

  clearTranscript: () => set({ messages: [], partial: '', asrError: null }),

  addPhoto: (imageDataUrl) => {
    const id = `photo-${Date.now().toString(36)}`;
    set((state) => ({ messages: [...state.messages, { id, kind: 'photo', imageDataUrl }] }));
    return id;
  },

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
