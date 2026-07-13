/**
 * Agent 执行循环：流式产出文本；若模型请求 tool call，执行工具后回填继续，
 * 直到产出纯文本回复或达到迭代上限。
 */
import { env } from '../config/env.js';
import { arkStreamChat } from './providers/ark.js';
import type {
  AgentDefinition,
  AgentRunOptions,
  AgentRunResult,
  ChatMessage,
  StreamChatFn,
} from './types.js';

const DEFAULT_MAX_ITERATIONS = 5;

export async function runAgent(
  def: AgentDefinition,
  userMessages: ChatMessage[],
  opts: AgentRunOptions = {},
  streamChat: StreamChatFn = arkStreamChat,
): Promise<AgentRunResult> {
  // 知识资料拼到 system prompt 尾部（内容稳定，有利于方舟前缀缓存命中、降低延迟）
  const systemContent = def.knowledge
    ? `${def.systemPrompt}\n\n====== 候选人背景资料（作答时充分结合，勿逐条罗列） ======\n\n${def.knowledge}`
    : def.systemPrompt;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...userMessages,
  ];
  const maxIterations = def.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const toolByName = new Map((def.tools ?? []).map((t) => [t.name, t]));

  for (let i = 1; i <= maxIterations; i++) {
    const { content, toolCalls } = await streamChat({
      model: def.model ?? env.ark.modelId,
      messages,
      temperature: def.temperature,
      thinking: def.thinking,
      maxTokens: def.maxTokens,
      tools: def.tools,
      onToken: opts.onToken,
      signal: opts.signal,
    });

    if (toolCalls.length === 0) {
      return { content, iterations: i };
    }

    // 回填 assistant 的 tool_calls 与各工具执行结果，进入下一轮
    messages.push({ role: 'assistant', content });
    for (const call of toolCalls) {
      const tool = toolByName.get(call.name);
      let result: string;
      if (!tool) {
        result = `工具 ${call.name} 不存在`;
      } else {
        try {
          result = await tool.execute(JSON.parse(call.arguments || '{}'));
        } catch (err) {
          result = `工具执行失败: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      messages.push({ role: 'tool', content: result, tool_call_id: call.id });
    }
  }

  throw new Error(`Agent ${def.name} 超过最大迭代次数 ${maxIterations}`);
}
