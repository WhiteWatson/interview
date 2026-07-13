/**
 * Agent harness 核心类型。
 * 设计目标：模型 provider / system prompt / tools 可插拔，
 * 新增一个 Agent 只需提供一份 AgentDefinition。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
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

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  /** 不填则用 env 中的默认模型（ARK_MODEL_ID） */
  model?: string;
  temperature?: number;
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
  tools?: AgentTool[];
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  content: string;
  toolCalls: ToolCall[];
}

export type StreamChatFn = (params: StreamChatParams) => Promise<StreamChatResult>;
