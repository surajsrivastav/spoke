import { env } from '@harness/shared';
import type { LLMProvider } from './types.js';
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAICompatibleProvider } from './openai-compat.js';

export type { LLMProvider, Message, ContentBlock, ToolDefinition, ModelResponse, ToolUseBlock, TextBlock, ToolResultBlock } from './types.js';

export function createProvider(): LLMProvider {
  switch (env.MODEL_PROVIDER) {
    case 'anthropic':
      return createAnthropicProvider(env.ANTHROPIC_API_KEY);

    case 'openrouter':
      return createOpenAICompatibleProvider(env.OPENROUTER_API_KEY, 'https://openrouter.ai/api/v1');

    case 'copilot':
      return createOpenAICompatibleProvider(env.COPILOT_TOKEN, 'https://api.githubcopilot.com/v1');

    case 'github-models':
      return createOpenAICompatibleProvider(env.GH_TOKEN, 'https://models.inference.ai.azure.com');

    case 'litellm':
      return createOpenAICompatibleProvider(env.OPENROUTER_API_KEY || env.ANTHROPIC_API_KEY, env.LITELLM_BASE_URL);

    case 'ollama':
      return createOpenAICompatibleProvider('ollama', env.OLLAMA_BASE_URL);

    default:
      throw new Error(`Unknown MODEL_PROVIDER: ${env.MODEL_PROVIDER}`);
  }
}
