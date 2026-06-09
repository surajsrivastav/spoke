import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTaskUpdate, mockTaskRunCreate, mockPullRequestCreate } = vi.hoisted(() => ({
  mockTaskUpdate: vi.fn(),
  mockTaskRunCreate: vi.fn(),
  mockPullRequestCreate: vi.fn(),
}));

vi.mock('@harness/db', () => ({
  prisma: {
    task: { update: mockTaskUpdate },
    taskRun: { create: mockTaskRunCreate },
    pullRequest: { create: mockPullRequestCreate },
  },
}));

const {
  mockProvisionSandbox,
  mockDestroySandbox,
  mockRunAgentLoop,
  mockRunVerification,
  mockPushBranch,
  mockCreatePr,
} = vi.hoisted(() => ({
  mockProvisionSandbox: vi.fn(),
  mockDestroySandbox: vi.fn(),
  mockRunAgentLoop: vi.fn(),
  mockRunVerification: vi.fn(),
  mockPushBranch: vi.fn(),
  mockCreatePr: vi.fn(),
}));

vi.mock('@harness/agent', () => ({
  provisionSandbox: mockProvisionSandbox,
  destroySandbox: mockDestroySandbox,
  runAgentLoop: mockRunAgentLoop,
  runVerification: mockRunVerification,
  pushBranch: mockPushBranch,
  createPr: mockCreatePr,
}));

const { mockWriteProvenance } = vi.hoisted(() => ({
  mockWriteProvenance: vi.fn(),
}));

vi.mock('@harness/provenance', () => ({
  writeProvenance: mockWriteProvenance,
}));

const { mockRandomUUID } = vi.hoisted(() => ({
  mockRandomUUID: vi.fn(() => 'uuid-123'),
}));

vi.mock('node:crypto', () => ({
  randomUUID: mockRandomUUID,
}));

import {
  updateTaskStatus,
  provisionSandbox,
  runAgent,
  verify,
  pushBranch,
  createPr,
  killTask,
  destroySandbox,
} from '../activities/index.js';

describe('activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  describe('updateTaskStatus', () => {
    it('updates the task status in the database', async () => {
      mockTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'running' });

      const result = await updateTaskStatus('task-1', 'running');

      expect(console.log).toHaveBeenCalledWith('[activity] updateTaskStatus: taskId=task-1, status=running');
      expect(mockTaskUpdate).toHaveBeenCalledTimes(1);
      expect(mockTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'running' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('propagates error when prisma update fails', async () => {
      mockTaskUpdate.mockRejectedValue(new Error('DB error'));

      await expect(updateTaskStatus('task-1', 'running')).rejects.toThrow('DB error');
      expect(console.log).toHaveBeenCalledWith('[activity] updateTaskStatus: taskId=task-1, status=running');
    });
  });

  describe('provisionSandbox', () => {
    it('creates a taskRun, provisions sandbox, and writes provenance', async () => {
      mockTaskRunCreate.mockResolvedValue({ id: 'uuid-123' });
      mockProvisionSandbox.mockResolvedValue({ sandboxId: 'sandbox-abc' });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await provisionSandbox('task-1');

      expect(console.log).toHaveBeenCalledWith('[activity] provisionSandbox: taskId=task-1, taskRunId=uuid-123');
      expect(mockRandomUUID).toHaveBeenCalled();
      expect(mockTaskRunCreate).toHaveBeenCalledTimes(1);
      expect(mockTaskRunCreate).toHaveBeenCalledWith({
        data: {
          id: 'uuid-123',
          task_id: 'task-1',
          attempt: 1,
          workflow_id: 'agent-task',
          status: 'provisioning',
        },
      });
      expect(mockProvisionSandbox).toHaveBeenCalledTimes(1);
      expect(mockProvisionSandbox).toHaveBeenCalledWith();
      expect(mockWriteProvenance).toHaveBeenCalledTimes(1);
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'uuid-123',
          type: 'tool_called',
          payload: { action: 'provision_sandbox', sandboxId: 'sandbox-abc' },
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
      expect(result).toEqual({ sandboxId: 'sandbox-abc', taskRunId: 'uuid-123' });
    });

    it('propagates error when provisioning fails', async () => {
      mockTaskRunCreate.mockResolvedValue({ id: 'uuid-123' });
      mockProvisionSandbox.mockRejectedValue(new Error('Sandbox limit exceeded'));

      await expect(provisionSandbox('task-1')).rejects.toThrow('Sandbox limit exceeded');
      expect(console.log).toHaveBeenCalledWith('[activity] provisionSandbox: taskId=task-1, taskRunId=uuid-123');
    });

    it('propagates error when taskRun creation fails', async () => {
      mockTaskRunCreate.mockRejectedValue(new Error('DB write failed'));

      await expect(provisionSandbox('task-1')).rejects.toThrow('DB write failed');
      expect(console.log).toHaveBeenCalledWith('[activity] provisionSandbox: taskId=task-1, taskRunId=uuid-123');
    });
  });

  describe('runAgent', () => {
    it('calls runAgentLoop and writes provenance', async () => {
      mockRunAgentLoop.mockResolvedValue({
        result: 'patched the file',
        totalTokens: 500,
        totalCost: 0.01,
      });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await runAgent('sandbox-abc', 'fix the bug', 'run-1');

      expect(console.log).toHaveBeenCalledWith('[activity] runAgent: sandboxId=sandbox-abc, taskRunId=run-1');
      expect(mockRunAgentLoop).toHaveBeenCalledTimes(1);
      expect(mockRunAgentLoop).toHaveBeenCalledWith('sandbox-abc', 'fix the bug', 'run-1', undefined);
      expect(mockWriteProvenance).toHaveBeenCalledTimes(1);
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'run-1',
          type: 'tool_called',
          payload: { action: 'agent_run', result: 'patched the file' },
          costUsd: 0.01,
          tokens: 500,
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
      expect(result).toEqual({ result: 'patched the file' });
    });

    it('passes prevErrors to runAgentLoop', async () => {
      mockRunAgentLoop.mockResolvedValue({
        result: 'retry succeeded',
        totalTokens: 300,
        totalCost: 0.005,
      });
      mockWriteProvenance.mockResolvedValue(undefined);
      const prevErrors = { verification: 'lint failed' };

      await runAgent('sandbox-abc', 'fix lint', 'run-2', prevErrors);

      expect(console.log).toHaveBeenCalledWith('[activity] runAgent: sandboxId=sandbox-abc, taskRunId=run-2');
      expect(mockRunAgentLoop).toHaveBeenCalledWith('sandbox-abc', 'fix lint', 'run-2', prevErrors);
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
    });

    it('propagates error when agent loop fails', async () => {
      mockRunAgentLoop.mockRejectedValue(new Error('Agent crashed'));

      await expect(runAgent('sandbox-abc', 'fix', 'run-1')).rejects.toThrow('Agent crashed');
      expect(console.log).toHaveBeenCalledWith('[activity] runAgent: sandboxId=sandbox-abc, taskRunId=run-1');
    });

    it('truncates long result in provenance write', async () => {
      const longResult = 'x'.repeat(1000);
      mockRunAgentLoop.mockResolvedValue({
        result: longResult,
        totalTokens: 100,
        totalCost: 0.01,
      });
      mockWriteProvenance.mockResolvedValue(undefined);

      await runAgent('sandbox-abc', 'goal', 'run-1');

      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            result: longResult.slice(0, 500),
          }),
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.payload.result.length).toBe(500);
    });
  });

  describe('verify', () => {
    it('calls runVerification and writes provenance', async () => {
      mockRunVerification.mockResolvedValue({ passed: true, errors: {} });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');

      expect(console.log).toHaveBeenCalledWith('[activity] verify: sandboxId=sandbox-abc');
      expect(mockRunVerification).toHaveBeenCalledTimes(1);
      expect(mockRunVerification).toHaveBeenCalledWith('sandbox-abc');
      expect(mockWriteProvenance).toHaveBeenCalledTimes(1);
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'run-1',
          type: 'verification_run',
          payload: { passed: true, errors: {} },
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
      expect(result).toEqual({ passed: true, errors: {} });
    });

    it('returns failed verification result', async () => {
      const errors = { lint: 'unused variable' };
      mockRunVerification.mockResolvedValue({ passed: false, errors });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');

      expect(console.log).toHaveBeenCalledWith('[activity] verify: sandboxId=sandbox-abc');
      expect(result).toEqual({ passed: false, errors });
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
    });

    it('propagates error when verification fails', async () => {
      mockRunVerification.mockRejectedValue(new Error('Verification timeout'));

      await expect(verify('sandbox-abc', 'run-1')).rejects.toThrow('Verification timeout');
      expect(console.log).toHaveBeenCalledWith('[activity] verify: sandboxId=sandbox-abc');
    });
  });

  describe('pushBranch', () => {
    it('pushes a branch and writes provenance', async () => {
      mockPushBranch.mockResolvedValue({ branch: 'fix-bug-123' });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await pushBranch('sandbox-abc', 'https://github.com/org/repo', 'fix the bug', 'run-1', 'task-1');

      expect(console.log).toHaveBeenCalledWith('[activity] pushBranch: sandboxId=sandbox-abc, taskRunId=run-1');
      expect(mockPushBranch).toHaveBeenCalledTimes(1);
      expect(mockPushBranch).toHaveBeenCalledWith('sandbox-abc', 'https://github.com/org/repo', 'fix the bug', 'task-1');
      expect(mockWriteProvenance).toHaveBeenCalledTimes(1);
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'run-1',
          type: 'commit_made',
          payload: { branch: 'fix-bug-123', sandboxId: 'sandbox-abc' },
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
      expect(result).toEqual({ branch: 'fix-bug-123' });
    });

    it('propagates error when push fails', async () => {
      mockPushBranch.mockRejectedValue(new Error('Git push rejected'));

      await expect(
        pushBranch('sandbox-abc', 'https://github.com/org/repo', 'fix', 'run-1', 'task-1'),
      ).rejects.toThrow('Git push rejected');
      expect(console.log).toHaveBeenCalledWith('[activity] pushBranch: sandboxId=sandbox-abc, taskRunId=run-1');
    });
  });

  describe('createPr', () => {
    it('creates PR via agent and saves to database', async () => {
      mockCreatePr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/42', prNumber: 42 });
      mockPullRequestCreate.mockResolvedValue({ id: 'uuid-123' });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await createPr('https://github.com/org/repo', 'fix-bug-123', 'fix the bug', 'run-1', 'task-1', 'Closes #123');

      expect(console.log).toHaveBeenCalledWith('[activity] createPr: branch=fix-bug-123, goal=fix the bug');
      expect(mockCreatePr).toHaveBeenCalledTimes(1);
      expect(mockCreatePr).toHaveBeenCalledWith('https://github.com/org/repo', 'fix-bug-123', 'fix the bug', 'Closes #123');
      expect(mockPullRequestCreate).toHaveBeenCalledTimes(1);
      expect(mockPullRequestCreate).toHaveBeenCalledWith({
        data: {
          id: 'uuid-123',
          task_id: 'task-1',
          github_url: 'https://github.com/org/repo/pull/42',
          number: 42,
          state: 'open',
        },
      });
      expect(mockWriteProvenance).toHaveBeenCalledTimes(1);
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'run-1',
          type: 'pr_opened',
          payload: { branch: 'fix-bug-123', goal: 'fix the bug', prUrl: 'https://github.com/org/repo/pull/42' },
        }),
      );
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
      expect(result).toEqual({ prUrl: 'https://github.com/org/repo/pull/42' });
    });

    it('works without optional description', async () => {
      mockCreatePr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/1', prNumber: 1 });
      mockPullRequestCreate.mockResolvedValue({ id: 'uuid-456' });
      mockWriteProvenance.mockResolvedValue(undefined);

      await createPr('https://github.com/org/repo', 'main', 'update', 'run-2', 'task-2');

      expect(console.log).toHaveBeenCalledWith('[activity] createPr: branch=main, goal=update');
      expect(mockCreatePr).toHaveBeenCalledWith('https://github.com/org/repo', 'main', 'update', undefined);
      const provenance = mockWriteProvenance.mock.calls[0][0];
      expect(provenance.durationMs).toBeGreaterThanOrEqual(0);
      expect(provenance.durationMs).toBeLessThan(60000);
    });

    it('propagates error when PR creation fails', async () => {
      mockCreatePr.mockRejectedValue(new Error('GitHub API rate limit exceeded'));

      await expect(
        createPr('https://github.com/org/repo', 'branch', 'goal', 'run-1', 'task-1'),
      ).rejects.toThrow('GitHub API rate limit exceeded');
      expect(console.log).toHaveBeenCalledWith('[activity] createPr: branch=branch, goal=goal');
    });

    it('propagates error when DB insert fails after PR creation', async () => {
      mockCreatePr.mockResolvedValue({ prUrl: 'https://github.com/org/repo/pull/1', prNumber: 1 });
      mockPullRequestCreate.mockRejectedValue(new Error('DB constraint violation'));

      await expect(
        createPr('https://github.com/org/repo', 'branch', 'goal', 'run-1', 'task-1'),
      ).rejects.toThrow('DB constraint violation');
      expect(console.log).toHaveBeenCalledWith('[activity] createPr: branch=branch, goal=goal');
    });
  });

  describe('killTask', () => {
    it('sets task status to killed', async () => {
      mockTaskUpdate.mockResolvedValue({ id: 'task-1', status: 'killed' });

      const result = await killTask('task-1');

      expect(console.log).toHaveBeenCalledWith('[activity] killTask: taskId=task-1');
      expect(mockTaskUpdate).toHaveBeenCalledTimes(1);
      expect(mockTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'killed' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('propagates error when kill update fails', async () => {
      mockTaskUpdate.mockRejectedValue(new Error('DB gone'));

      await expect(killTask('task-1')).rejects.toThrow('DB gone');
      expect(console.log).toHaveBeenCalledWith('[activity] killTask: taskId=task-1');
    });
  });

  describe('destroySandbox', () => {
    it('calls agent destroySandbox and returns ok', async () => {
      mockDestroySandbox.mockResolvedValue(undefined);

      const result = await destroySandbox('sandbox-abc');

      expect(console.log).toHaveBeenCalledWith('[activity] destroySandbox: sandboxId=sandbox-abc');
      expect(mockDestroySandbox).toHaveBeenCalledTimes(1);
      expect(mockDestroySandbox).toHaveBeenCalledWith('sandbox-abc');
      expect(result).toEqual({ ok: true });
    });

    it('propagates error when destroy fails', async () => {
      mockDestroySandbox.mockRejectedValue(new Error('Sandbox not found'));

      await expect(destroySandbox('sandbox-abc')).rejects.toThrow('Sandbox not found');
      expect(console.log).toHaveBeenCalledWith('[activity] destroySandbox: sandboxId=sandbox-abc');
    });
  });
});
