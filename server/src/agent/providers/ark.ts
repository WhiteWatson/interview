/**
 * 火山方舟（豆包）provider —— OpenAI 兼容接口。
 * 文档：https://ark.volcengine.com/docs/82379/1399008
 */
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { env } from '../../config/env.js';
import type { StreamChatFn, ToolCall } from '../types.js';

const client = new OpenAI({
  apiKey: env.ark.apiKey,
  baseURL: env.ark.baseUrl,
});

export const arkStreamChat: StreamChatFn = async ({
  model,
  messages,
  temperature,
  tools,
  onToken,
  signal,
}) => {
  const openaiTools: ChatCompletionTool[] | undefined = tools?.length
    ? tools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    : undefined;

  const stream = await client.chat.completions.create(
    {
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      tools: openaiTools,
      stream: true,
    },
    { signal },
  );

  let content = '';
  // tool call 的增量分片按 index 聚合
  const toolCallsByIndex = new Map<number, ToolCall>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      content += delta.content;
      onToken?.(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      const existing = toolCallsByIndex.get(tc.index);
      if (existing) {
        existing.arguments += tc.function?.arguments ?? '';
      } else {
        toolCallsByIndex.set(tc.index, {
          id: tc.id ?? `call_${tc.index}`,
          name: tc.function?.name ?? '',
          arguments: tc.function?.arguments ?? '',
        });
      }
    }
  }

  return { content, toolCalls: [...toolCallsByIndex.values()] };
};
