import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockActivities = vi.hoisted(() => ({
  updateTaskStatus: vi.fn<[string, string], Promise<{ ok: true }>>(),
  provisionSandbox: vi.fn<[string], Promise<{ sandboxId: string; taskRunId: string }>>(),
  cloneRepo: vi.fn<[string, string, string], Promise<{ ok: true }>>(),
  runAgent: vi.fn<[string, string, string, Record<string, unknown> | undefined], Promise<{ result: string }>>(),
  verify: vi.fn<[string, string], Promise<{ passed: boolean; errors: Record<string, unknown> }>>(),
  pushBranch: vi.fn<[string, string, string, string, string], Promise<{ branch: string }>>(),
  createPr: vi.fn<[string, string, string, string, string, string | undefined], Promise<{ prUrl: string }>>(),
  destroySandbox: vi.fn<[string], Promise<{ ok: true }>>(),
}));

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: vi.fn(() => mockActivities),
  defineSignal: vi.fn(() => 'kill'),
  setHandler: vi.fn(),
  uuid4: vi.fn(() => 'test-uuid'),
  sleep: vi.fn(),
}));

import { setupSubAgent } from '../workflows/sub-agents/setup.js';
import { executeSubAgent } from '../workflows/sub-agents/execute.js';
import { verifySubAgent } from '../workflows/sub-agents/verify.js';
import { githubSubAgent } from '../workflows/sub-agents/github.js';
import { cleanupSubAgent } from '../workflows/sub-agents/cleanup.js';

describe('setupSubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
    mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
    mockActivities.cloneRepo.mockResolvedValue({ ok: true });
  });

  it('provisions sandbox and clones repo', async () => {
    const result = await setupSubAgent({ taskId: 'task-1', repoUrl: 'https://github.com/org/repo.git' });

    expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
    expect(mockActivities.provisionSandbox).toHaveBeenCalledWith('task-1');
    expect(mockActivities.cloneRepo).toHaveBeenCalledWith('sandbox-1', 'https://github.com/org/repo.git', 'run-1');
    expect(result).toEqual({ ok: true, sandboxId: 'sandbox-1', taskRunId: 'run-1' });
  });

  it('propagates errors from provisionSandbox', async () => {
    mockActivities.provisionSandbox.mockRejectedValue(new Error('Docker unavailable'));

    await expect(
      setupSubAgent({ taskId: 'task-1', repoUrl: 'https://github.com/org/repo.git' }),
    ).rejects.toThrow('Docker unavailable');
  });

  it('propagates errors from cloneRepo', async () => {
    mockActivities.cloneRepo.mockRejectedValue(new Error('Git clone failed'));

    await expect(
      setupSubAgent({ taskId: 'task-1', repoUrl: 'https://github.com/org/repo.git' }),
    ).rejects.toThrow('Git clone failed');
  });

  it('does not clone when provisionSandbox fails', async () => {
    mockActivities.provisionSandbox.mockRejectedValue(new Error('no space left'));

    await expect(
      setupSubAgent({ taskId: 'task-1', repoUrl: 'https://github.com/org/repo.git' }),
    ).rejects.toThrow('no space left');
    expect(mockActivities.cloneRepo).not.toHaveBeenCalled();
  });
});

describe('executeSubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.runAgent.mockResolvedValue({ result: 'fixed the bug' });
  });

  it('runs the agent with given inputs', async () => {
    const result = await executeSubAgent({
      taskId: 'task-1',
      sandboxId: 'sandbox-1',
      goal: 'fix the bug',
      taskRunId: 'run-1',
    });

    expect(mockActivities.runAgent).toHaveBeenCalledWith('sandbox-1', 'fix the bug', 'run-1', undefined);
    expect(result).toEqual({ ok: true, result: 'fixed the bug' });
  });

  it('passes prevErrors to the agent run', async () => {
    const prevErrors = { lint: 'lint failed' };

    await executeSubAgent({
      taskId: 'task-1',
      sandboxId: 'sandbox-1',
      goal: 'fix the bug',
      taskRunId: 'run-1',
      prevErrors,
    });

    expect(mockActivities.runAgent).toHaveBeenCalledWith('sandbox-1', 'fix the bug', 'run-1', prevErrors);
  });

  it('propagates errors from runAgent', async () => {
    mockActivities.runAgent.mockRejectedValue(new Error('LLM rate limited'));

    await expect(
      executeSubAgent({
        taskId: 'task-1',
        sandboxId: 'sandbox-1',
        goal: 'fix the bug',
        taskRunId: 'run-1',
      }),
    ).rejects.toThrow('LLM rate limited');
  });
});

describe('verifySubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
  });

  it('returns passed result when verification succeeds', async () => {
    const result = await verifySubAgent({
      taskId: 'task-1',
      sandboxId: 'sandbox-1',
      taskRunId: 'run-1',
    });

    expect(mockActivities.verify).toHaveBeenCalledWith('sandbox-1', 'run-1');
    expect(result).toEqual({ ok: true, passed: true, errors: {} });
  });

  it('returns failed result when verification fails', async () => {
    mockActivities.verify.mockResolvedValue({
      passed: false,
      errors: { lint: 'eslint error', typecheck: 'TS123' },
    });

    const result = await verifySubAgent({
      taskId: 'task-1',
      sandboxId: 'sandbox-1',
      taskRunId: 'run-1',
    });

    expect(result).toEqual({
      ok: true,
      passed: false,
      errors: { lint: 'eslint error', typecheck: 'TS123' },
    });
  });

  it('propagates errors from verify', async () => {
    mockActivities.verify.mockRejectedValue(new Error('Sandbox not found'));

    await expect(
      verifySubAgent({
        taskId: 'task-1',
        sandboxId: 'sandbox-1',
        taskRunId: 'run-1',
      }),
    ).rejects.toThrow('Sandbox not found');
  });
});

describe('githubSubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.pushBranch.mockResolvedValue({ branch: 'fix-bug-123' });
    mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/42' });
    mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
  });

  it('pushes branch, creates PR, and updates task status', async () => {
    const result = await githubSubAgent({
      taskId: 'task-1',
      sandboxId: 'sandbox-1',
      repoUrl: 'https://github.com/org/repo',
      goal: 'fix bug 123',
      taskRunId: 'run-1',
      agentResult: 'fixed it',
    });

    expect(mockActivities.pushBranch).toHaveBeenCalledWith('sandbox-1', 'https://github.com/org/repo', 'fix bug 123', 'run-1', 'task-1');
    expect(mockActivities.createPr).toHaveBeenCalledWith('https://github.com/org/repo', 'fix-bug-123', 'fix bug 123', 'run-1', 'task-1', 'fixed it');
    expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'succeeded');
    expect(result).toEqual({ ok: true, branch: 'fix-bug-123', prUrl: 'https://github.com/org/repo/pull/42' });
  });

  it('propagates errors from pushBranch', async () => {
    mockActivities.pushBranch.mockRejectedValue(new Error('Push rejected'));

    await expect(
      githubSubAgent({
        taskId: 'task-1',
        sandboxId: 'sandbox-1',
        repoUrl: 'https://github.com/org/repo',
        goal: 'fix bug 123',
        taskRunId: 'run-1',
        agentResult: 'fixed it',
      }),
    ).rejects.toThrow('Push rejected');
    expect(mockActivities.createPr).not.toHaveBeenCalled();
  });

  it('propagates errors from createPr', async () => {
    mockActivities.createPr.mockRejectedValue(new Error('PR creation failed'));

    await expect(
      githubSubAgent({
        taskId: 'task-1',
        sandboxId: 'sandbox-1',
        repoUrl: 'https://github.com/org/repo',
        goal: 'fix bug 123',
        taskRunId: 'run-1',
        agentResult: 'fixed it',
      }),
    ).rejects.toThrow('PR creation failed');
    expect(mockActivities.updateTaskStatus).not.toHaveBeenCalledWith('task-1', 'succeeded');
  });
});

describe('cleanupSubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.destroySandbox.mockResolvedValue({ ok: true });
  });

  it('destroys the sandbox', async () => {
    const result = await cleanupSubAgent({ taskId: 'task-1', sandboxId: 'sandbox-1' });

    expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    expect(result).toEqual({ ok: true });
  });

  it('propagates errors from destroySandbox', async () => {
    mockActivities.destroySandbox.mockRejectedValue(new Error('Docker error'));

    await expect(
      cleanupSubAgent({ taskId: 'task-1', sandboxId: 'sandbox-1' }),
    ).rejects.toThrow('Docker error');
  });
});
