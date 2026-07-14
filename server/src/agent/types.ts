/**
 * Agent harness 核心类型。
 * 设计目标：模型 provider / system prompt / tools 可插拔，
 * 新增一个 Agent 只需提供一份 AgentDefinition。
 */

/** 多模态消息片段（图片输入用，OpenAI 兼容格式） */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** 纯文本，或多模态片段数组（文+图） */
  content: string | ContentPart[];
  /** tool 消息回填时使用 */
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  /** JSON 字符串形式的入参 */
  arguments: string;
}

/** 一个可被 Agent 调用的工具（预留扩展点：联网搜索、知识库等） */
export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema */
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/** 深度思考开关：disabled 关闭思考（最快，实时场景推荐）/ enabled 强制 / auto 由模型判断 */
export type ThinkingMode = 'enabled' | 'disabled' | 'auto';

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  /** 注入 system prompt 尾部的背景知识（如候选人简历、项目资料） */
  knowledge?: string;
  /** 不填则用 env 中的默认模型（ARK_MODEL_ID） */
  model?: string;
  temperature?: number;
  /** 深度思考模式，默认交给模型（auto）；实时场景设 disabled 提速 */
  thinking?: ThinkingMode;
  /** 上限输出 token，防止过长拖慢完成 */
  maxTokens?: number;
  tools?: AgentTool[];
  /** tool-call 循环上限，防失控 */
  maxIterations?: number;
}

export interface AgentRunOptions {
  /** 每个流式 token 的回调（用于 SSE 透传） */
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  content: string;
  iterations: number;
}

/** 模型 provider 的最小接口：换模型 = 换一个 StreamChatFn 实现 */
export interface StreamChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  thinking?: ThinkingMode;
  maxTokens?: number;
  tools?: AgentTool[];
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  content: string;
  toolCalls: ToolCall[];
}

export type StreamChatFn = (params: StreamChatParams) => Promise<StreamChatResult>;
