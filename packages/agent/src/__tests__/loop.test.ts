import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  MODEL_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  OPENROUTER_API_KEY: '',
  COPILOT_TOKEN: '',
  DEFAULT_MODEL: 'claude-sonnet-4-20250514',
  DEFAULT_COST_CAP_USD: 5,
  LITELLM_BASE_URL: '',
}));

const mockCreateMessage = vi.hoisted(() => vi.fn());
const mockCreateProvider = vi.hoisted(() => vi.fn(() => ({
  createMessage: mockCreateMessage,
})));

vi.mock('@spoke/shared', () => ({
  env: mockEnv,
}));

vi.mock('../providers/index.js', () => ({
  createProvider: mockCreateProvider,
}));

vi.mock('../sandbox.js', () => ({
  provisionSandbox: vi.fn(),
  destroySandbox: vi.fn(),
}));

vi.mock('../tools.js', () => ({
  executeShell: vi.fn(),
  executeReadFile: vi.fn(),
  executeWriteFile: vi.fn(),
  executeGit: vi.fn(),
  toolHandlers: {
    shell: vi.fn(),
    read_file: vi.fn(),
    write_file: vi.fn(),
    git: vi.fn(),
  },
}));

vi.mock('../verify.js', () => ({
  runVerification: vi.fn(),
}));

import { runAgentLoop } from '../loop.js';
import { toolHandlers } from '../tools.js';

const toolDefinitions = [
  {
    name: 'shell',
    description: 'Execute a shell command in the sandbox. Use absolute paths (e.g. cd /repo && command).',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'The shell command to execute' } },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the sandbox filesystem',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the file' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the sandbox',
    input_schema: {
      type: 'object',
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
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'Git arguments (e.g. ["status"])' },
      },
      required: ['args'],
    },
  },
];

describe('runAgentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.DEFAULT_COST_CAP_USD = 5;
    mockEnv.MODEL_PROVIDER = 'anthropic';
  });

  it('returns the text result when the model responds with text (no tool_use)', async () => {
    mockCreateMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'Task complete!' }],
      inputTokens: 10,
      outputTokens: 20,
    });

    const result = await runAgentLoop('test-sid', 'Do the thing', 'task-run-1');

    expect(result.result).toBe('Task complete!');
    expect(result.totalTokens).toBe(30);
    expect(result.totalCost).toBe((10 * 3 + 20 * 15) / 1_000_000);
  });

  it('processes tool_use blocks and continues the loop', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'echo hi' } }],
        inputTokens: 5,
        outputTokens: 10,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'All done' }],
        inputTokens: 5,
        outputTokens: 10,
      });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: 'hi',
      stderr: '',
      exitCode: 0,
    });

    const result = await runAgentLoop('test-sid', 'Say hi', 'task-run-1');

    expect(toolHandlers.shell).toHaveBeenCalledWith('test-sid', { command: 'echo hi' });
    expect(result.result).toBe('All done');
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });

  it('handles unknown tool names gracefully', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'call-1', name: 'unknown_tool', input: {} }],
        inputTokens: 5,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'done' }],
        inputTokens: 5,
        outputTokens: 5,
      });

    const result = await runAgentLoop('test-sid', 'test', 'task-run-1');

    expect(result.result).toBe('done');
    const secondCallArgs = mockCreateMessage.mock.calls[1];
    const msgs = secondCallArgs[2];
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[2].role).toBe('user');
    expect(msgs[2].content[0].type).toBe('tool_result');
    expect(msgs[2].content[0].content).toBe('Unknown tool: unknown_tool');
    expect(msgs[2].content[0].is_error).toBe(true);
  });

  it('handles tool execution errors gracefully', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'fail' } }],
        inputTokens: 5,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'recovered' }],
        inputTokens: 5,
        outputTokens: 5,
      });

    vi.mocked(toolHandlers.shell).mockRejectedValue(new Error('command crashed'));

    const result = await runAgentLoop('test-sid', 'test', 'task-run-1');

    expect(result.result).toBe('recovered');
    const secondCallArgs = mockCreateMessage.mock.calls[1];
    const msgs = secondCallArgs[2];
    expect(msgs[2].content[0].type).toBe('tool_result');
    expect(msgs[2].content[0].content).toBe('Error: command crashed');
    expect(msgs[2].content[0].is_error).toBe(true);
  });

  it('passes previous errors as context in the initial messages', async () => {
    mockCreateMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'fixed' }],
      inputTokens: 5,
      outputTokens: 5,
    });

    const prevErrors = { lint: 'Missing semicolon', typecheck: 'Type X not found' };

    await runAgentLoop('test-sid', 'fix all', 'task-run-1', prevErrors);

    const callArgs = mockCreateMessage.mock.calls[0];
    const msgs = callArgs[2];
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toContain('Missing semicolon');
    expect(msgs[0].content).toContain('Type X not found');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('/repo/');
    expect(msgs[1].content).toContain('fix all');
  });

  it('does not add prevErrors context when prevErrors is undefined', async () => {
    mockCreateMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'done' }],
      inputTokens: 5,
      outputTokens: 5,
    });

    await runAgentLoop('test-sid', 'just do it', 'task-run-1');

    const callArgs = mockCreateMessage.mock.calls[0];
    const msgs = callArgs[2];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain('/repo/');
    expect(msgs[0].content).toContain('just do it');
  });

  it('enforces the cost cap and returns early', async () => {
    mockEnv.DEFAULT_COST_CAP_USD = 0;

    const result = await runAgentLoop('test-sid', 'expensive task', 'task-run-1');

    expect(mockCreateMessage).not.toHaveBeenCalled();
    expect(result.result).toContain('cost cap');
    expect(result.totalTokens).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('properly passes tool results back in the next iteration', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'ls' } }],
        inputTokens: 5,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'finished' }],
        inputTokens: 10,
        outputTokens: 5,
      });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: 'file1\nfile2',
      stderr: '',
      exitCode: 0,
    });

    await runAgentLoop('test-sid', 'list', 'task-run-1');

    const secondCallArgs = mockCreateMessage.mock.calls[1];
    const msgs = secondCallArgs[2];
    const assistantContent = msgs[1].content;
    const userContent = msgs[2].content;

    expect(assistantContent[0].type).toBe('tool_use');
    expect(assistantContent[0].id).toBe('call-1');
    expect(userContent[0].type).toBe('tool_result');
    expect(userContent[0].tool_use_id).toBe('call-1');
    expect(userContent[0].content).toContain('file1');
  });

  it('terminates after reaching max iterations', async () => {
    const usage = { inputTokens: 1, outputTokens: 1 };

    let callCount = 0;
    mockCreateMessage.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        content: [{ type: 'tool_use', id: `call-${callCount}`, name: 'shell', input: { command: 'nop' } }],
        ...usage,
      });
    });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const result = await runAgentLoop('test-sid', 'loop forever', 'task-run-1');

    expect(result.result).toContain('maximum iterations reached');
    expect(mockCreateMessage).toHaveBeenCalledTimes(50);
  });

  it('passes correct model, tools, and max_tokens to provider', async () => {
    mockCreateMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'done' }],
      inputTokens: 5,
      outputTokens: 5,
    });

    await runAgentLoop('test-sid', 'my goal', 'task-run-1');

    expect(mockCreateProvider).toHaveBeenCalledTimes(1);

    const callArgs = mockCreateMessage.mock.calls[0];
    expect(callArgs[0]).toBe('claude-sonnet-4-20250514');
    expect(callArgs[1]).toBe(4096);
    expect(callArgs[3]).toEqual(toolDefinitions);
    expect(callArgs[2]).toHaveLength(1);
    expect(callArgs[2][0].role).toBe('user');
    expect(callArgs[2][0].content).toContain('/repo/');
    expect(callArgs[2][0].content).toContain('my goal');
  });

  it('processes multiple tool calls in a single response', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'echo first' } },
          { type: 'tool_use', id: 'call-2', name: 'shell', input: { command: 'echo second' } },
        ],
        inputTokens: 10,
        outputTokens: 20,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'all done' }],
        inputTokens: 5,
        outputTokens: 5,
      });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: 'output', stderr: '', exitCode: 0,
    });

    const result = await runAgentLoop('test-sid', 'multi tool', 'task-run-1');

    expect(toolHandlers.shell).toHaveBeenCalledTimes(2);
    expect(toolHandlers.shell).toHaveBeenNthCalledWith(1, 'test-sid', { command: 'echo first' });
    expect(toolHandlers.shell).toHaveBeenNthCalledWith(2, 'test-sid', { command: 'echo second' });
    expect(result.result).toBe('all done');
  });

  it('accumulates costs across multiple iterations', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'ls' } }],
        inputTokens: 100,
        outputTokens: 200,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'done' }],
        inputTokens: 50,
        outputTokens: 100,
      });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });

    const result = await runAgentLoop('test-sid', 'task', 'task-run-1');

    const expectedTokens = 100 + 200 + 50 + 100;
    const expectedCost = (100 * 3 + 200 * 15 + 50 * 3 + 100 * 15) / 1_000_000;
    expect(result.totalTokens).toBe(expectedTokens);
    expect(result.totalCost).toBeCloseTo(expectedCost, 10);
  });

  it('handles response with mix of text and tool calls', async () => {
    mockCreateMessage
      .mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Let me check...' },
          { type: 'tool_use', id: 'call-1', name: 'shell', input: { command: 'echo hi' } },
        ],
        inputTokens: 5,
        outputTokens: 10,
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I checked' }],
        inputTokens: 5,
        outputTokens: 5,
      });

    vi.mocked(toolHandlers.shell).mockResolvedValue({
      stdout: 'hi', stderr: '', exitCode: 0,
    });

    const result = await runAgentLoop('test-sid', 'task', 'task-run-1');

    expect(toolHandlers.shell).toHaveBeenCalledTimes(1);
    expect(result.result).toBe('I checked');
  });

  it('joins multiple text blocks with newline when no tool calls', async () => {
    mockCreateMessage.mockResolvedValue({
      content: [
        { type: 'text', text: 'First line' },
        { type: 'text', text: 'Second line' },
      ],
      inputTokens: 5,
      outputTokens: 10,
    });

    const result = await runAgentLoop('test-sid', 'task', 'task-run-1');

    expect(result.result).toBe('First line\nSecond line');
  });
});
