/** 浏览器 ↔ 本服务 /ws/asr 的消息协议（JSON 文本帧 + 二进制 PCM 帧） */

/** 豆包 ASR 返回的分句信息 */
export interface AsrUtterance {
  text: string;
  start_time: number;
  end_time: number;
  /** true 表示该分句已判停、结果确定 */
  definite: boolean;
}

/** 豆包 ASR full server response 的 payload（服务端原样转发给浏览器） */
export interface AsrResultPayload {
  result?: {
    text?: string;
    utterances?: AsrUtterance[];
  };
  audio_info?: { duration?: number };
}

/** 服务端 → 浏览器 */
export type AsrServerMessage =
  | { type: 'ready' }
  | { type: 'result'; payload: AsrResultPayload; isFinal: boolean }
  | { type: 'error'; code?: number; message: string }
  | { type: 'closed' };

/** 浏览器 → 服务端（文本帧；音频用二进制帧直接发 PCM） */
export type AsrClientMessage = { type: 'end' };

/** POST /api/analyze 请求体 */
export interface AnalyzeRequest {
  /** 要分析的面试问题（识别出的一条消息文本） */
  question: string;
  /** 可选：对话上下文（此前若干条消息） */
  context?: string[];
}

/** POST /api/solve 请求体：拍照识别算法题并给解法 */
export interface SolveRequest {
  /** 题目图片，data URL（如 data:image/jpeg;base64,...） */
  image: string;
  /** 可选：用户补充说明（如"用 TypeScript 写"） */
  note?: string;
}

/** /api/analyze 与 /api/solve 共用的 SSE 事件 */
export type AnalyzeEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** 音频采集参数（前后端必须一致） */
export const ASR_AUDIO = {
  sampleRate: 16000,
  bits: 16,
  channels: 1,
  /** 分包时长（豆包文档：双向流式 200ms 性能最优） */
  chunkMs: 200,
} as const;
