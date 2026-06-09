import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ContentBlock, ModelResponse } from './types.js';

export function createAnthropicProvider(apiKey: string): LLMProvider {
  const client = new Anthropic({ apiKey });

  return {
    async createMessage(model, maxTokens, messages, tools): Promise<ModelResponse> {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: messages.map(m => {
          if (m.role === 'user') return { role: 'user' as const, content: m.content };
          return { role: 'assistant' as const, content: m.content };
        }),
        tools: tools as Anthropic.ToolUnion[],
      });

      return {
        content: response.content as ContentBlock[],
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}
