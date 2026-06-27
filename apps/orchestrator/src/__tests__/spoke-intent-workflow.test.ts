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
  createExecutionPlan: vi.fn<[string, string, string], Promise<{ strategy: string; agent_count: number; rationale: string }>>(),
  getDiffSize: vi.fn<[string], Promise<{ size: number }>>(),
  aggregateResults: vi.fn<[string, unknown[]], Promise<{ taskRunId: string; sandboxId: string; passed: boolean; confidence: number; diffSize: number } | null>>(),
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

import { spokeIntentWorkflow } from '../workflows/spoke-intent.js';

const INPUT = { taskId: 'task-1', goal: 'fix login bug', repoUrl: 'https://github.com/org/repo' };

describe('spokeIntentWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivities.updateTaskStatus.mockResolvedValue({ ok: true });
    mockActivities.destroySandbox.mockResolvedValue({ ok: true });
    mockActivities.getDiffSize.mockResolvedValue({ size: 50 });
  });

  function triggerKill() {
    killHandlerRef.current?.();
  }

  describe('single-agent happy path', () => {
    it('runs plan → provision → clone → agent → verify → push → PR → succeeded', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'single-agent', agent_count: 1, rationale: 'simple' });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sb-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'patched' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.aggregateResults.mockResolvedValue({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true, confidence: 0.85, diffSize: 50 });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'spoke/task-1-fix-login-bug' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/1' });

      const result = await spokeIntentWorkflow(INPUT);

      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
      expect(mockActivities.createExecutionPlan).toHaveBeenCalledWith('task-1', 'fix login bug', 'https://github.com/org/repo');
      expect(mockActivities.provisionSandbox).toHaveBeenCalledTimes(1);
      expect(mockActivities.cloneRepo).toHaveBeenCalledWith('sb-1', 'https://github.com/org/repo', 'run-1');
      expect(mockActivities.runAgent).toHaveBeenCalledWith('sb-1', 'fix login bug', 'run-1', undefined);
      expect(mockActivities.verify).toHaveBeenCalledWith('sb-1', 'run-1');
      expect(mockActivities.getDiffSize).toHaveBeenCalledWith('sb-1');
      expect(mockActivities.aggregateResults).toHaveBeenCalledWith('task-1', expect.arrayContaining([
        expect.objectContaining({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true }),
      ]));
      expect(mockActivities.pushBranch).toHaveBeenCalledWith('sb-1', 'https://github.com/org/repo', 'fix login bug', 'run-1', 'task-1');
      expect(mockActivities.createPr).toHaveBeenCalledWith('https://github.com/org/repo', 'spoke/task-1-fix-login-bug', 'fix login bug', 'run-1', 'task-1');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'succeeded');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sb-1');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('multi-agent fan-out', () => {
    it('provisions two sandboxes and aggregates when dual-agent', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'dual-agent', agent_count: 2, rationale: 'medium' });
      mockActivities.provisionSandbox
        .mockResolvedValueOnce({ sandboxId: 'sb-1', taskRunId: 'run-1' })
        .mockResolvedValueOnce({ sandboxId: 'sb-2', taskRunId: 'run-2' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'patched' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.aggregateResults.mockResolvedValue({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true, confidence: 0.88, diffSize: 30 });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'spoke/task-1-fix' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/2' });

      await spokeIntentWorkflow(INPUT);

      expect(mockActivities.provisionSandbox).toHaveBeenCalledTimes(2);
      expect(mockActivities.cloneRepo).toHaveBeenCalledTimes(2);
      expect(mockActivities.runAgent).toHaveBeenCalledTimes(2);
      expect(mockActivities.verify).toHaveBeenCalledTimes(2);
      expect(mockActivities.aggregateResults).toHaveBeenCalledWith('task-1', expect.arrayContaining([
        expect.objectContaining({ sandboxId: 'sb-1' }),
        expect.objectContaining({ sandboxId: 'sb-2' }),
      ]));
      expect(mockActivities.destroySandbox).toHaveBeenCalledTimes(2);
    });
  });

  describe('verification retries', () => {
    it('retries agent up to 3 times on verification failure', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'single-agent', agent_count: 1, rationale: 'simple' });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sb-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'patched' });
      mockActivities.verify
        .mockResolvedValueOnce({ passed: false, errors: { lint: 'failed' } })
        .mockResolvedValueOnce({ passed: true, errors: {} });
      mockActivities.aggregateResults.mockResolvedValue({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true, confidence: 0.8, diffSize: 50 });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockResolvedValue({ prUrl: 'url' });

      await spokeIntentWorkflow(INPUT);

      expect(mockActivities.runAgent).toHaveBeenCalledTimes(2);
      expect(mockActivities.verify).toHaveBeenCalledTimes(2);
      expect(mockActivities.runAgent).toHaveBeenNthCalledWith(2, 'sb-1', 'fix login bug', 'run-1', { lint: 'failed' });
    });
  });

  describe('all agents fail', () => {
    it('sets task to failed when no agent passes verification', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'single-agent', agent_count: 1, rationale: 'simple' });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sb-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'patched' });
      mockActivities.verify.mockResolvedValue({ passed: false, errors: { lint: 'always fails' } });
      mockActivities.aggregateResults.mockResolvedValue(null);

      const result = await spokeIntentWorkflow(INPUT);

      expect(mockActivities.pushBranch).not.toHaveBeenCalled();
      expect(mockActivities.createPr).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('kill signal', () => {
    async function freshWorkflow() {
      vi.resetModules();
      return (await import('../workflows/spoke-intent.js')).spokeIntentWorkflow;
    }

    it('stops after plan when killed', async () => {
      const wf = await freshWorkflow();
      mockActivities.createExecutionPlan.mockImplementationOnce(async () => {
        triggerKill();
        return { strategy: 'single-agent', agent_count: 1, rationale: 'simple' };
      });

      await wf(INPUT);

      expect(mockActivities.provisionSandbox).not.toHaveBeenCalled();
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'killed');
    });

    it('destroys all provisioned sandboxes when killed during execution', async () => {
      const wf = await freshWorkflow();
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'dual-agent', agent_count: 2, rationale: 'medium' });
      mockActivities.provisionSandbox
        .mockResolvedValueOnce({ sandboxId: 'sb-1', taskRunId: 'run-1' })
        .mockResolvedValueOnce({ sandboxId: 'sb-2', taskRunId: 'run-2' });
      mockActivities.cloneRepo.mockImplementationOnce(async () => {
        triggerKill();
        return { ok: true };
      });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.aggregateResults.mockResolvedValue({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true, confidence: 0.8, diffSize: 0 });

      await wf(INPUT);

      // Both sandboxes were provisioned before kill was detected; both should be cleaned up
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sb-1');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sb-2');
    });
  });

  describe('error handling', () => {
    it('marks task failed and re-throws when provisioning throws', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'single-agent', agent_count: 1, rationale: 'simple' });
      mockActivities.provisionSandbox.mockRejectedValue(new Error('Quota exceeded'));

      await expect(spokeIntentWorkflow(INPUT)).rejects.toThrow('Quota exceeded');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('marks task failed when PR creation throws', async () => {
      mockActivities.createExecutionPlan.mockResolvedValue({ strategy: 'single-agent', agent_count: 1, rationale: 'simple' });
      mockActivities.provisionSandbox.mockResolvedValue({ sandboxId: 'sb-1', taskRunId: 'run-1' });
      mockActivities.cloneRepo.mockResolvedValue({ ok: true });
      mockActivities.runAgent.mockResolvedValue({ result: 'ok' });
      mockActivities.verify.mockResolvedValue({ passed: true, errors: {} });
      mockActivities.aggregateResults.mockResolvedValue({ taskRunId: 'run-1', sandboxId: 'sb-1', passed: true, confidence: 0.9, diffSize: 20 });
      mockActivities.pushBranch.mockResolvedValue({ branch: 'b' });
      mockActivities.createPr.mockRejectedValue(new Error('GitHub API error'));

      await expect(spokeIntentWorkflow(INPUT)).rejects.toThrow('GitHub API error');
      expect(mockActivities.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
      expect(mockActivities.destroySandbox).toHaveBeenCalledWith('sb-1');
    });
  });
});
