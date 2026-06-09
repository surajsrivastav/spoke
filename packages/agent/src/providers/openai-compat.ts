import OpenAI from 'openai';
import type { LLMProvider, Message, ContentBlock, ToolDefinition, ModelResponse } from './types.js';

function toOpenAITools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

function isFunctionToolCall(
  tc: OpenAI.Chat.ChatCompletionMessageToolCall,
): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall & { function: { name: string; arguments: string } } {
  return tc.type === 'function';
}

function toOpenAIMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'user' && typeof msg.content === 'string') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          const content = block.is_error
            ? `Error: ${block.content}`
            : block.content;
          result.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content,
          });
        } else {
          result.push({ role: 'user', content: block.content ?? '' });
        }
      }
    } else if (msg.role === 'assistant') {
      const textBlocks = msg.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text');
      const toolBlocks = msg.content.filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use');

      if (toolBlocks.length === 0) {
        const text = textBlocks.map(b => b.text).join('\n');
        result.push({ role: 'assistant', content: text });
      } else {
        if (textBlocks.length > 0) {
          result.push({ role: 'assistant', content: textBlocks.map(b => b.text).join('\n') });
        }
        const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolBlocks.map(b => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        }));
        result.push({ role: 'assistant', content: null, tool_calls: toolCalls });
      }
    }
  }

  return result;
}

function fromOpenAIResponse(choice: OpenAI.Chat.ChatCompletion.Choice): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const { message } = choice;

  if (message.content) {
    blocks.push({ type: 'text', text: message.content });
  }

  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      if (isFunctionToolCall(tc)) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }
  }

  return blocks;
}

export function createOpenAICompatibleProvider(apiKey: string, baseURL: string): LLMProvider {
  const client = new OpenAI({ apiKey, baseURL });

  return {
    async createMessage(model, maxTokens, messages, tools): Promise<ModelResponse> {
      const openaiMessages = toOpenAIMessages(messages);
      const openaiTools = toOpenAITools(tools);

      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      const choice = response.choices[0];
      const content = fromOpenAIResponse(choice);

      return {
        content,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };
    },
  };
}
