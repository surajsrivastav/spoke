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

describe('F-02: Sandboxed Agent Execution — Acceptance Criteria', () => {
  beforeAll(() => {
    expect(proxyActivities).toHaveBeenCalledWith(
      expect.objectContaining({ startToCloseTimeout: '5 minutes' }),
    );
    expect(defineSignal).toHaveBeenCalledWith('kill');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy path — agent successfully implements a feature end-to-end', () => {
    it('completes full workflow: provision → clone → runAgent → verify → push → PR', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-abc', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'implemented JWT auth' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'feat/jwt-auth-abc' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/42' });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      const result = await agentTaskWorkflow({
        taskId: 'task-01',
        goal: 'add JWT auth to Express API',
        repoUrl: 'https://github.com/org/repo',
      });

      expect(mockActivities.provisionSandbox).toHaveBeenCalledWith('task-01');
      expect(mockActivities.cloneRepo).toHaveBeenCalledWith('sandbox-abc', 'https://github.com/org/repo', 'run-1');
      expect(mockActivities.runAgent).toHaveBeenCalledWith('sandbox-abc', 'add JWT auth to Express API', 'run-1', undefined);
      expect(mockActivities.verify).toHaveBeenCalledWith('sandbox-abc', 'run-1');
      expect(mockActivities.pushBranch).toHaveBeenCalledWith('sandbox-abc', 'https://github.com/org/repo', 'add JWT auth to Express API', 'run-1', 'task-01');
      expect(mockActivities.createPr).toHaveBeenCalledWith('https://github.com/org/repo', 'feat/jwt-auth-abc', 'add JWT auth to Express API', 'run-1', 'task-01', 'implemented JWT auth');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-01', 'succeeded');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-abc');
      expect(result).toEqual({ ok: true });
    });

    it('tracks task status transitions through all phases', async () => {
      const statuses: string[] = [];
      mockActivities.updateTaskStatus.mockImplementation(async (_id: string, status: string) => {
        statuses.push(status);
        return { ok: true };
      });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'done' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'url' });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await agentTaskWorkflow({ taskId: 'task-1', goal: 'g', repoUrl: 'r' });

      expect(statuses).toEqual(['running', 'succeeded']);
    });
  });

  describe('Sad paths', () => {
    it('fails when sandbox provision times out and sets status to failed', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockRejectedValue(new Error('SandboxProvisionError: timeout after 30s'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix', repoUrl: 'r' }),
      ).rejects.toThrow('SandboxProvisionError: timeout after 30s');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).not.toHaveBeenCalled();
    });

    it('fails when repo access is denied (private repo, no token)', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockRejectedValue(new Error('RepoAccessError: Repository not found'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix', repoUrl: 'https://github.com/org/private-repo' }),
      ).rejects.toThrow('RepoAccessError: Repository not found');

      expect(mockActivities.cloneRepo).toHaveBeenCalled();
      expect(mockActivities.runAgent).not.toHaveBeenCalled();
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });

    it('fails task when agent throws a non-transient error mid-execution', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockRejectedValue(new Error('RateLimitError: 429 Too Many Requests'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix', repoUrl: 'r' }),
      ).rejects.toThrow('RateLimitError: 429 Too Many Requests');

      expect(mockActivities.runAgent).toHaveBeenCalledTimes(1);
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });
  });

  describe('Edge cases', () => {
    it('passes errors from previous steps to agent for context on retry', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent
        .mockResolvedValueOnce({ result: 'step 1-3' })
        .mockResolvedValueOnce({ result: 'fix attempt' });
      mockActivities.verify
        .mockResolvedValueOnce({ passed: false, errors: { typecheck: 'TS2322: Type mismatch' } })
        .mockResolvedValueOnce({ passed: true, errors: {} });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'url' });
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await agentTaskWorkflow({ taskId: 'task-1', goal: 'fix types', repoUrl: 'r' });

      expect(mockActivities.runAgent).toHaveBeenCalledTimes(2);
      expect(mockActivities.runAgent).toHaveBeenNthCalledWith(1, 'sandbox-1', 'fix types', 'run-1', undefined);
      expect(mockActivities.runAgent).toHaveBeenNthCalledWith(2, 'sandbox-1', 'fix types', 'run-1', { typecheck: 'TS2322: Type mismatch' });
    });

    it('fails task when cost cap is exceeded mid-execution', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockRejectedValue(new Error('CostCapExceededError: cost cap $5.00 reached'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'complex task', repoUrl: 'r' }),
      ).rejects.toThrow('CostCapExceededError: cost cap $5.00 reached');

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });

    it('destroys sandbox on any unexpected failure', async () => {
      mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockRejectedValue(new Error('filesystem_error: file_write failed'));
      mockActivities.destroySandbox.mockResolvedValue({ ok: true });

      await expect(
        agentTaskWorkflow({ taskId: 'task-1', goal: 'fix', repoUrl: 'r' }),
      ).rejects.toThrow('filesystem_error: file_write failed');

      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sandbox-1');
    });
  });
});
