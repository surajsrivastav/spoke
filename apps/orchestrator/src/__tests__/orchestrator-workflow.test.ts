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

type ExecuteChildMock = <T>(workflowType: string, opts: { args: unknown[]; workflowId: string; taskQueue: string }) => Promise<T>;

interface Handlers {
  kill: (() => void) | undefined;
  query: ((...args: unknown[]) => unknown) | undefined;
}

const handlersRef = vi.hoisted<{ current: Handlers }>(() => ({
  current: { kill: undefined, query: undefined },
}));

const executeChildRef = vi.hoisted<{ current: ExecuteChildMock }>(() => ({
  current: (async (_workflowType: string, _opts: { args: unknown[] }) => {
    return { ok: true } as never;
  }) as unknown as ExecuteChildMock,
}));

const mockSetHandler = vi.hoisted(() =>
  vi.fn((name: unknown, handler: () => void | ((...args: unknown[]) => unknown)) => {
    if (name === 'kill') {
      handlersRef.current.kill = handler as () => void;
    } else {
      handlersRef.current.query = handler as (...args: unknown[]) => unknown;
    }
  }),
);

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: vi.fn(() => mockActivities),
  executeChild: ((...args: unknown[]) => {
    const fn = executeChildRef.current as unknown as (...a: unknown[]) => Promise<unknown>;
    return fn(...args);
  }) as never,
  defineSignal: vi.fn(() => 'kill'),
  defineQuery: vi.fn(() => 'getSubAgents'),
  setHandler: mockSetHandler,
  uuid4: vi.fn(() => 'test-uuid'),
  sleep: vi.fn(),
  CancellationScope: { nonCancellable: vi.fn((fn: () => unknown) => fn()) },
  ActivityFailure: class ActivityFailure extends Error {},
  ApplicationFailure: { create: vi.fn() },
}));

import { orchestratorWorkflow } from '../workflows/orchestrator.js';

function triggerKill() {
  handlersRef.current.kill?.();
}

function getSubAgentStates(): Array<{ id: string; status: string }> {
  return handlersRef.current.query?.() as Array<{ id: string; status: string }>;
}

function defaultExecuteChild<R = unknown>(workflowType: string, _opts: { args: unknown[] }): Promise<R> {
  switch (workflowType) {
    case 'setupSubAgent':
      return Promise.resolve({ ok: true, sandboxId: 'sandbox-1', taskRunId: 'run-1' } as never);
    case 'executeSubAgent':
      return Promise.resolve({ ok: true, result: 'agent-result' } as never);
    case 'verifySubAgent':
      return Promise.resolve({ ok: true, passed: true, errors: {} } as never);
    case 'githubSubAgent':
      return Promise.resolve({ ok: true, branch: 'fix-bug-123', prUrl: 'https://github.com/org/repo/pull/1' } as never);
    case 'cleanupSubAgent':
      return Promise.resolve({ ok: true } as never);
    default:
      return Promise.resolve({ ok: true } as never);
  }
}

describe('orchestratorWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
    executeChildRef.current = defaultExecuteChild as unknown as ExecuteChildMock;
  });

  describe('happy path', () => {
    it('runs all phases in order and succeeds', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: true });
    });

    it('executes sub-agents in the correct order', async () => {
      const callOrder: string[] = [];
      executeChildRef.current = (async (workflowType: string, _opts: { args: unknown[] }) => {
        callOrder.push(workflowType);
        return defaultExecuteChild(workflowType, _opts);
      }) as unknown as ExecuteChildMock;

      await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(callOrder).toEqual([
        'setupSubAgent',
        'executeSubAgent',
        'verifySubAgent',
        'githubSubAgent',
        'cleanupSubAgent',
      ]);
    });

    it('tracks sub-agent states with correct statuses', async () => {
      await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      const states = getSubAgentStates();
      expect(states).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'setup', status: 'succeeded' }),
          expect.objectContaining({ id: 'execute-0', status: 'succeeded' }),
          expect.objectContaining({ id: 'verify-0', status: 'succeeded' }),
          expect.objectContaining({ id: 'github', status: 'succeeded' }),
          expect.objectContaining({ id: 'cleanup', status: 'succeeded' }),
        ]),
      );
    });

    it('assigns unique workflow IDs to each sub-agent', async () => {
      const workflowIds: string[] = [];
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[]; workflowId: string }) => {
        workflowIds.push(opts.workflowId);
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(workflowIds).toEqual([
        'task-1-setup-v0',
        'task-1-execute-0-v0',
        'task-1-verify-0-v0',
        'task-1-github-v0',
        'task-1-cleanup-v0',
      ]);
    });
  });

  describe('verification retries', () => {
    it('retries on verification failure and succeeds on second attempt', async () => {
      let verifyCount = 0;
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[] }) => {
        if (workflowType === 'verifySubAgent') {
          verifyCount++;
          if (verifyCount === 1) {
            return { ok: true, passed: false, errors: { lint: 'lint failed' } } as never;
          }
          return { ok: true, passed: true, errors: {} } as never;
        }
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: true });
      const states = getSubAgentStates();
      const executeStates = states.filter((s) => s.id.startsWith('execute-'));
      const verifyStates = states.filter((s) => s.id.startsWith('verify-'));
      expect(executeStates).toHaveLength(2);
      expect(verifyStates).toHaveLength(2);
      expect(verifyStates[0]).toEqual(expect.objectContaining({ id: 'verify-0', status: 'succeeded' }));
      expect(verifyStates[1]).toEqual(expect.objectContaining({ id: 'verify-1', status: 'succeeded' }));
    });

    it('retries up to 3 attempts and fails task when verification never passes', async () => {
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[] }) => {
        if (workflowType === 'verifySubAgent') {
          return { ok: true, passed: false, errors: { test: 'always fails' } } as never;
        }
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: false });
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');

      const states = getSubAgentStates();
      const executeStates = states.filter((s) => s.id.startsWith('execute-'));
      const verifyStates = states.filter((s) => s.id.startsWith('verify-'));
      expect(executeStates).toHaveLength(3);
      expect(verifyStates).toHaveLength(3);

      expect(states.find((s) => s.id === 'github')).toBeUndefined();
      expect(states.find((s) => s.id === 'cleanup')).toBeDefined();
    });

    it('passes prevErrors from failed verification to next execute attempt', async () => {
      let verifyCount = 0;
      const receivedErrors: unknown[] = [];
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[] }) => {
        const args = opts.args[0] as Record<string, unknown>;
        if (workflowType === 'executeSubAgent') {
          receivedErrors.push(args.prevErrors);
        }
        if (workflowType === 'verifySubAgent') {
          verifyCount++;
          if (verifyCount === 1) {
            return { ok: true, passed: false, errors: { lint: 'lint failed' } } as never;
          }
          return { ok: true, passed: false, errors: { test: 'still fails' } } as never;
        }
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(receivedErrors[0]).toBeUndefined();
      expect(receivedErrors[1]).toEqual({ lint: 'lint failed' });
      expect(receivedErrors[2]).toEqual({ test: 'still fails' });
    });
  });

  describe('kill signal', () => {
    it('stops after setup when killed before execute phase', async () => {
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[] }) => {
        if (workflowType === 'setupSubAgent') {
          return { ok: true, sandboxId: 'sandbox-1', taskRunId: 'run-1' } as never;
        }
        if (workflowType === 'executeSubAgent') {
          triggerKill();
        }
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: false });
      const states = getSubAgentStates();
      expect(states.find((s) => s.id === 'setup')?.status).toBe('succeeded');
      expect(states.find((s) => s.id === 'github')).toBeUndefined();
      expect(states.find((s) => s.id === 'cleanup')?.status).toBe('succeeded');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('stops mid-verify loop and does not proceed to github', async () => {
      executeChildRef.current = (async (workflowType: string, opts: { args: unknown[] }) => {
        if (workflowType === 'verifySubAgent') {
          triggerKill();
          return { ok: true, passed: true, errors: {} } as never;
        }
        return defaultExecuteChild(workflowType, opts);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: false });
      const states = getSubAgentStates();
      expect(states.find((s) => s.id === 'github')).toBeUndefined();
      expect(states.find((s) => s.id === 'cleanup')?.status).toBe('succeeded');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('handles kill before setup runs', async () => {
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'setupSubAgent') {
          triggerKill();
          return { ok: true, sandboxId: 'sandbox-1', taskRunId: 'run-1' } as never;
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: false });
      expect(mockActivities.updateTaskStatus).not.toHaveBeenCalledWith('task-1', 'failed');
    });
  });

  describe('error handling', () => {
    it('sets status to failed when setup sub-agent throws', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'setupSubAgent') {
          throw new Error('Setup failed');
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      await expect(
        orchestratorWorkflow({
          taskId: 'task-1',
          goal: 'fix bug',
          repoUrl: 'https://github.com/org/repo',
        }),
      ).rejects.toThrow('Setup failed');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledTimes(1);
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('sets status to failed when execute sub-agent throws', async () => {
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'executeSubAgent') {
          throw new Error('Agent crashed');
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      await expect(
        orchestratorWorkflow({
          taskId: 'task-1',
          goal: 'fix bug',
          repoUrl: 'https://github.com/org/repo',
        }),
      ).rejects.toThrow('Agent crashed');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      const states = getSubAgentStates();
      expect(states.find((s) => s.id === 'cleanup')?.status).toBe('succeeded');
    });

    it('sets status to failed when github sub-agent throws', async () => {
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'githubSubAgent') {
          throw new Error('GitHub API error');
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      await expect(
        orchestratorWorkflow({
          taskId: 'task-1',
          goal: 'fix bug',
          repoUrl: 'https://github.com/org/repo',
        }),
      ).rejects.toThrow('GitHub API error');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      const states = getSubAgentStates();
      expect(states.find((s) => s.id === 'github')?.status).toBe('failed');
      expect(states.find((s) => s.id === 'cleanup')?.status).toBe('succeeded');
    });

    it('does not throw from cleanup sub-agent failures in finally', async () => {
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'cleanupSubAgent') {
          throw new Error('Cleanup failed');
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      const result = await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('sub-agent state tracking', () => {
    it('reports correct number of sub-agents', async () => {
      await orchestratorWorkflow({
        taskId: 'task-1',
        goal: 'fix bug',
        repoUrl: 'https://github.com/org/repo',
      });

      const states = getSubAgentStates();
      expect(states).toHaveLength(5);
    });

    it('reports failed status for failed sub-agents', async () => {
      executeChildRef.current = (async (workflowType: string) => {
        if (workflowType === 'executeSubAgent') {
          throw new Error('crash');
        }
        return defaultExecuteChild(workflowType);
      }) as unknown as ExecuteChildMock;

      await expect(
        orchestratorWorkflow({
          taskId: 'task-1',
          goal: 'fix bug',
          repoUrl: 'https://github.com/org/repo',
        }),
      ).rejects.toThrow('crash');

      const states = getSubAgentStates();
      const execState = states.find((s) => s.id.startsWith('execute-'));
      expect(execState?.status).toBe('failed');
      expect(execState?.error).toBe('crash');
    });
  });
});
