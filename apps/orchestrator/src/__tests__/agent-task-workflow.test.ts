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

const killHandlerRef = vi.hoisted(() => ({ current: undefined as (() => void) | undefined }));

const mockSetHandler = vi.hoisted(() =>
  vi.fn((_signal: unknown, handler: () => void) => {
    killHandlerRef.current = handler;
  }),
);

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: vi.fn(() => mockActivities),
  defineSignal: vi.fn(() => 'kill'),
  setHandler: mockSetHandler,
  uuid4: vi.fn(() => 'test-uuid'),
  sleep: vi.fn(),
  CancellationScope: { nonCancellable: vi.fn((fn: () => unknown) => fn()) },
  ActivityFailure: class ActivityFailure extends Error {},
  ApplicationFailure: { create: vi.fn() },
}));

import { proxyActivities, defineSignal } from '@temporalio/workflow';
import { agentTaskWorkflow } from '../workflows/agent-task.js';

describe('agentTaskWorkflow', () => {
  beforeAll(() => {
    expect(proxyActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        startToCloseTimeout: '5 minutes',
        retry: expect.objectContaining({ initialInterval: '10 seconds', maximumAttempts: 3 }),
      }),
    );
    expect(defineSignal).toHaveBeenCalledWith('kill');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function triggerKill() {
    killHandlerRef.current?.();
  }

  describe('happy path', () => {
    it('runs through all steps and succeeds', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'agent-result' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'fix-bug-123' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/1' });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.updateTaskStatus).toHaveBeenNthCalledWith(1, 'task-1', 'running');
      expect(mockActivities.provisionSandbox).toHaveBeenCalledWith('task-1');
      expect(mockActivities.cloneRepo).toHaveBeenCalledWith('sandbox-1', 'https://github.com/org/repo', 'run-1');
      expect(mockActivities.runAgent).toHaveBeenCalledWith('sandbox-1', 'fix bug', 'run-1', undefined, 'task-1');
      expect(mockActivities.verify).toHaveBeenCalledWith('sandbox-1', 'run-1');
      expect(mockActivities.pushBranch).toHaveBeenCalledWith('sandbox-1', 'https://github.com/org/repo', 'fix bug', 'run-1', 'task-1');
      expect(mockActivities.createPr).toHaveBeenCalledWith('https://github.com/org/repo', 'fix-bug-123', 'fix bug', 'run-1', 'task-1', 'agent-result');
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'succeeded');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });

    it('calls activities in the correct order', async () => {
      const callOrder: string[] = [];
      mockActivities.updateTaskStatus.mockImplementation(async (_id: string, status: string) => {
        callOrder.push(`updateTaskStatus(${status})`);
        return { ok: true };
      });
      mockActivities.provisionSandbox.mockImplementation(async () => {
        callOrder.push('provisionSandbox');
        return { sandboxId: 'sandbox-1', taskRunId: 'run-1' };
      });
      mockActivities.cloneRepo.mockImplementation(async () => {
        callOrder.push('cloneRepo');
        return { ok: true };
      });
      mockActivities.runAgent.mockImplementation(async () => {
        callOrder.push('runAgent');
        return { result: 'ok' };
      });
      mockActivities.verify.mockImplementation(async () => {
        callOrder.push('verify');
        return { passed: true, errors: {} };
      });
      mockActivities.pushBranch.mockImplementation(async () => {
        callOrder.push('pushBranch');
        return { branch: 'b' };
      });
      mockActivities.createPr.mockImplementation(async () => {
        callOrder.push('createPr');
        return { prUrl: 'url' };
      });
      mockActivities.destroySandbox.mockImplementation(async () => {
        callOrder.push('destroySandbox');
        return { ok: true };
      });

      await agentTaskWorkflow({ taskId: 'task-1', goal: 'g', repoUrl: 'r' });

      expect(callOrder).toEqual([
        'updateTaskStatus(running)',
        'provisionSandbox',
        'cloneRepo',
        'runAgent',
        'verify',
        'pushBranch',
        'createPr',
        'updateTaskStatus(succeeded)',
        'destroySandbox',
      ]);
    });
  });

  describe('verification retries', () => {
    it('retries verification on failure and succeeds on second attempt', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'agent-result' });
      mockActivities.verify
        .mockResolvedValueOnce({ passed: false, errors: { error1: 'lint failed' } })
        .mockResolvedValueOnce({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'fix-bug-123' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/1' });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.runAgent).toHaveBeenCalledTimes(2);
      expect(mockActivities.runAgent).toHaveBeenNthCalledWith(1, 'sandbox-1', 'fix bug', 'run-1', undefined, 'task-1');
      expect(mockActivities.runAgent).toHaveBeenNthCalledWith(2, 'sandbox-1', 'fix bug', 'run-1', { error1: 'lint failed' }, 'task-1');
      expect(mockActivities.verify).toHaveBeenCalledTimes(2);
      expect(mockActivities.pushBranch).toHaveBeenCalled();
      expect(mockActivities.createPr).toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'succeeded');
      expect(result).toEqual({ ok: true });
    });

    it('retries up to 3 attempts and fails verification', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'agent-result' });
      mockActivities.verify.mockResolvedValue({ passed: false, errors: { error: 'always fails' } });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.runAgent).toHaveBeenCalledTimes(3);
      expect(mockActivities.verify).toHaveBeenCalledTimes(3);
      expect(mockActivities.pushBranch).not.toHaveBeenCalled();
      expect(mockActivities.createPr).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('error handling', () => {
    it('sets status to failed and destroys sandbox when provisioning fails', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockRejectedValue(new Error('Provision failed'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' }),
      ).rejects.toThrow('Provision failed');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).not.toHaveBeenCalled();
    });

    it('sets status to failed and destroys sandbox when agent run fails', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockRejectedValue(new Error('Agent crashed'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' }),
      ).rejects.toThrow('Agent crashed');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });

    it('sets status to failed when PR creation fails', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockRejectedValue(new Error('PR creation failed'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' }),
      ).rejects.toThrow('PR creation failed');

      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });

    it('does not throw from destroySandbox failures in finally', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'url' });
      mockActivities.destroySandbox.mockRejectedValue(new Error('Destroy failed'));

      const result = await agentTaskWorkflow({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.destroySandbox).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('kill signal', () => {
    async function freshWorkflow() {
      vi.resetModules();
      return (await import('../workflows/agent-task.js')).agentTaskWorkflow;
    }

    it('handles kill signal after cloneRepo', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockImplementationOnce(async () => {
        triggerKill();
        return { ok: true };
      });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
      expect(mockActivities.provisionSandbox).toHaveBeenCalled();
      expect(mockActivities.cloneRepo).toHaveBeenCalled();
      expect(mockActivities.runAgent).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });

    it('handles kill signal after sandbox provision', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockImplementationOnce(async () => {
        triggerKill();
        return { sandboxId: 'sandbox-1', taskRunId: 'run-1' };
      });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.provisionSandbox).toHaveBeenCalled();
      expect(mockActivities.runAgent).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });

    it('stops after updateTaskStatus when killed before provisionSandbox', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockImplementationOnce(async () => {
        triggerKill();
        return { ok: true };
      });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.provisionSandbox).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('handles kill signal after runAgent', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockImplementationOnce(async () => {
        triggerKill();
        return { result: 'ok' };
      });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.runAgent).toHaveBeenCalled();
      expect(mockActivities.verify).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });

    it('handles kill signal after verify', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockImplementationOnce(async () => {
        triggerKill();
        return { passed: true, errors: {} };
      });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.runAgent).toHaveBeenCalled();
      expect(mockActivities.verify).toHaveBeenCalled();
      expect(mockActivities.pushBranch).not.toHaveBeenCalled();
      expect(mockActivities.createPr).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });

    it('handles kill signal after pushBranch', async () => {
      const wf = await freshWorkflow();
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockImplementationOnce(async () => {
        triggerKill();
        return { branch: 'b' };
      });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await wf({ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' });

      expect(mockActivities.createPr).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenLastCalledWith('task-1', 'killed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
      expect(result).toEqual({ ok: true });
    });
  });
});
