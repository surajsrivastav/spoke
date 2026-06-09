import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@spoke/agent', () => ({
  provisionSandbox: mockProvisionSandbox,
  destroySandbox: mockDestroySandbox,
  runAgentLoop: mockRunAgentLoop,
  runVerification: mockRunVerification,
  pushBranch: mockPushBranch,
  createPr: mockCreatePr,
}));

const { mockWriteProvenance } = vi.hoisted(() => ({ mockWriteProvenance: vi.fn() }));
vi.mock('@spoke/provenance', () => ({ writeProvenance: mockWriteProvenance }));

const { mockTaskUpdate, mockTaskRunCreate, mockPullRequestCreate } = vi.hoisted(() => ({
  mockTaskUpdate: vi.fn(),
  mockTaskRunCreate: vi.fn(),
  mockPullRequestCreate: vi.fn(),
}));

vi.mock('@spoke/db', () => ({
  prisma: {
    task: { update: mockTaskUpdate, findUnique: vi.fn() },
    taskRun: { create: mockTaskRunCreate, groupBy: vi.fn() },
    pullRequest: { create: mockPullRequestCreate },
  },
}));

vi.mock('node:crypto', () => ({ randomUUID: () => 'uuid-123' }));

import { verify, runAgent } from '../activities/index.js';

describe('F-03: Verification Gates — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  describe('Happy path — all gates pass', () => {
    it('passes verification and returns passed=true', async () => {
      mockRunVerification.mockResolvedValue({ passed: true, errors: {} });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');

      expect(result).toEqual({ passed: true, errors: {} });
      expect(mockRunVerification).toHaveBeenCalledWith('sandbox-abc');
      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          taskRunId: 'run-1',
          type: 'verification_run',
          payload: { passed: true, errors: {} },
        }),
      );
    });
  });

  describe('Sad paths', () => {
    it('fails verification and returns errors', async () => {
      mockRunVerification.mockResolvedValue({
        passed: false,
        errors: { typecheck: "Type 'string' is not assignable to type 'number'" },
      });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');

      expect(result.passed).toBe(false);
      expect(result.errors).toEqual({ typecheck: "Type 'string' is not assignable to type 'number'" });
    });

    it('propagates error when verification crashes', async () => {
      mockRunVerification.mockRejectedValue(new Error('Verification timeout after 30s'));
      await expect(verify('sandbox-abc', 'run-1')).rejects.toThrow('Verification timeout after 30s');
    });
  });

  describe('Edge cases', () => {
    it('passes with lint warnings (non-blocking)', async () => {
      mockRunVerification.mockResolvedValue({ passed: true, errors: { lintWarnings: 3 } });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');
      expect(result.passed).toBe(true);
      expect(result.errors).toEqual({ lintWarnings: 3 });
    });

    it('passes verification with empty errors object', async () => {
      mockRunVerification.mockResolvedValue({ passed: true, errors: {} });
      mockWriteProvenance.mockResolvedValue(undefined);

      const result = await verify('sandbox-abc', 'run-1');
      expect(result.passed).toBe(true);
    });

    it('writes provenance for verification run', async () => {
      mockRunVerification.mockResolvedValue({ passed: false, errors: { test: '2 of 15 tests failed' } });
      mockWriteProvenance.mockResolvedValue(undefined);

      await verify('sandbox-abc', 'run-1');

      expect(mockWriteProvenance).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'verification_run',
          payload: { passed: false, errors: { test: '2 of 15 tests failed' } },
        }),
      );
    });
  });
});

describe('F-03: Verification — Agent retry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    mockRunAgentLoop.mockResolvedValue({ result: 'fix', totalTokens: 50, totalCost: 0.01 });
    mockWriteProvenance.mockResolvedValue(undefined);
  });

  it('passes prevErrors to the next agent run for context', async () => {
    const prevErrors = { typecheck: 'TS2322: Type mismatch' };

    await runAgent('sandbox-abc', 'fix types', 'run-2', prevErrors);

    expect(mockRunAgentLoop).toHaveBeenCalledWith('sandbox-abc', 'fix types', 'run-2', prevErrors);
  });

  it('truncates long results in provenance logging', async () => {
    const longResult = 'x'.repeat(1000);
    mockRunAgentLoop.mockResolvedValue({ result: longResult, totalTokens: 100, totalCost: 0.01 });

    await runAgent('sandbox-abc', 'goal', 'run-1');

    expect(mockWriteProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ result: longResult.slice(0, 500) }),
      }),
    );
  });

  it('propagates agent loop errors', async () => {
    mockRunAgentLoop.mockRejectedValue(new Error('Agent crashed after 3 retries'));

    await expect(runAgent('sandbox-abc', 'goal', 'run-1')).rejects.toThrow('Agent crashed after 3 retries');
  });
});
