import { env } from '@spoke/shared';
import { createProvider } from './providers/index.js';
import type { ToolUseBlock, TextBlock } from './providers/types.js';
import { toolHandlers } from './tools.js';

type ToolResultBlockParam = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

const toolDefinitions = [
  {
    name: 'shell',
    description: 'Execute a shell command in the sandbox. Use absolute paths (e.g. cd /repo && command).',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the sandbox filesystem',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the sandbox',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'git',
    description: 'Execute a git command in the sandbox',
    input_schema: {
      type: 'object' as const,
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'Git arguments (e.g. ["status"])' },
      },
      required: ['args'],
    },
  },
];

function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputRate = 3;
  const outputRate = 15;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

export async function runAgentLoop(
  sandboxId: string,
  goal: string,
  taskRunId: string,
  prevErrors?: Record<string, unknown>,
): Promise<{ result: string; totalTokens: number; totalCost: number }> {
  const provider = createProvider();

  const messages: (
    { role: 'user'; content: string | ToolResultBlockParam[] }
    | { role: 'assistant'; content: (TextBlock | ToolUseBlock)[] }
  )[] = [];

  if (prevErrors) {
    messages.push({
      role: 'user',
      content: `The previous verification run failed with these errors: ${JSON.stringify(prevErrors)}. Please fix all issues.`,
    });
  }

  messages.push({
    role: 'user',
    content: `The repository is cloned to /repo/. All file paths must be absolute (e.g. /repo/index.js).\n\n${goal}`,
  });

  const costCap = env.DEFAULT_COST_CAP_USD;
  let totalTokens = 0;
  let totalCost = 0;

  for (let iteration = 0; iteration < 50; iteration++) {
    if (totalCost >= costCap) {
      return {
        result: `Agent loop terminated: cost cap of $${costCap} reached. Total tokens: ${totalTokens}.`,
        totalTokens,
        totalCost,
      };
    }

    const response = await provider.createMessage(
      env.DEFAULT_MODEL,
      4096,
      messages,
      toolDefinitions,
    );

    totalTokens += response.inputTokens + response.outputTokens;
    totalCost += estimateCost(response.inputTokens, response.outputTokens);

    const toolCalls = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

    if (toolCalls.length === 0) {
      const text = response.content
        .filter((b): b is TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { result: text, totalTokens, totalCost };
    }

    const toolResults: ToolResultBlockParam[] = [];

    for (const toolCall of toolCalls) {
      const handler = toolHandlers[toolCall.name];
      if (!handler) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Unknown tool: ${toolCall.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await handler(sandboxId, toolCall.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content as (TextBlock | ToolUseBlock)[] });
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    result: 'Agent loop terminated: maximum iterations reached.',
    totalTokens,
    totalCost,
  };
}
