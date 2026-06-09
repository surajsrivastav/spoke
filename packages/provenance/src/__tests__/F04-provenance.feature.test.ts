import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@harness/db', () => ({
  prisma: { provenance: { create: mockCreate } },
}));

import { writeProvenance } from '../index.js';

describe('F-04: Provenance and Trace Logging — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'prov-1' });
  });

  describe('Happy path', () => {
    it('writes model_called event with cost, tokens, and duration', async () => {
      await writeProvenance({
        taskRunId: 'run-1',
        type: 'model_response',
        payload: { model: 'claude-sonnet-4', response: 'some output' },
        costUsd: 0.05,
        tokens: 500,
        durationMs: 1200,
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const arg = mockCreate.mock.calls[0][0].data;
      expect(arg.task_run_id).toBe('run-1');
      expect(arg.type).toBe('model_response');
      expect(arg.cost_usd).toBe(0.05);
      expect(arg.tokens).toBe(500);
      expect(arg.duration_ms).toBe(1200);
    });

    it('writes tool_called event', async () => {
      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: { action: 'execute_shell', command: 'npm test' },
        costUsd: 0,
        tokens: 0,
        durationMs: 340,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'tool_called',
          payload: { action: 'execute_shell', command: 'npm test' },
        }),
      });
    });

    it('writes verification_run event', async () => {
      await writeProvenance({
        taskRunId: 'run-1',
        type: 'verification_run',
        payload: { passed: true, errors: {} },
        costUsd: 0,
        tokens: 0,
        durationMs: 5000,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'verification_run',
          payload: { passed: true, errors: {} },
        }),
      });
    });
  });

  describe('Sad paths', () => {
    it('propagates error when database write fails', async () => {
      mockCreate.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        writeProvenance({
          taskRunId: 'run-1',
          type: 'tool_called',
          payload: { action: 'test' },
          costUsd: 0,
          tokens: 0,
          durationMs: 0,
        }),
      ).rejects.toThrow('DB connection lost');
    });

    it('propagates database timeout error', async () => {
      mockCreate.mockRejectedValue(new Error('Database timeout'));

      await expect(
        writeProvenance({
          taskRunId: 'run-1',
          type: 'tool_called',
          payload: { action: 'test' },
          costUsd: 0,
          tokens: 0,
          durationMs: 0,
        }),
      ).rejects.toThrow('Database timeout');
    });
  });

  describe('Edge cases', () => {
    it('handles zero values for cost, tokens, and duration', async () => {
      mockCreate.mockResolvedValue(undefined);

      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: { action: 'no-op' },
        costUsd: 0,
        tokens: 0,
        durationMs: 0,
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const arg = mockCreate.mock.calls[0][0].data;
      expect(arg.cost_usd).toBe(0);
      expect(arg.tokens).toBe(0);
      expect(arg.duration_ms).toBe(0);
    });

    it('handles large payloads (10KB+)', async () => {
      const largePayload = { data: 'x'.repeat(10000) };
      mockCreate.mockResolvedValue(undefined);

      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: largePayload,
        costUsd: 0,
        tokens: 0,
        durationMs: 0,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ payload: largePayload }),
      });
    });

    it('handles all provenance event types', async () => {
      const types = ['plan_created', 'tool_called', 'model_response', 'verification_run', 'commit_made', 'pr_opened'] as const;

      for (const type of types) {
        mockCreate.mockClear();
        mockCreate.mockResolvedValue(undefined);

        await writeProvenance({
          taskRunId: 'run-1',
          type,
          payload: { test: true },
          costUsd: 0.01,
          tokens: 100,
          durationMs: 500,
        });

        expect(mockCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({ type }),
        });
      }
    });

    it('handles deeply nested payload objects', async () => {
      const nested = { level1: { level2: { level3: { value: 'deep' } } } };
      mockCreate.mockResolvedValue(undefined);

      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: nested,
        costUsd: 0,
        tokens: 0,
        durationMs: 0,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ payload: nested }),
      });
    });

    it('generates a unique id for each provenance record', async () => {
      mockCreate.mockResolvedValue(undefined);

      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: {},
        costUsd: 0,
        tokens: 0,
        durationMs: 0,
      });

      const id1 = mockCreate.mock.calls[0][0].data.id;

      mockCreate.mockClear();
      mockCreate.mockResolvedValue(undefined);

      await writeProvenance({
        taskRunId: 'run-1',
        type: 'tool_called',
        payload: {},
        costUsd: 0,
        tokens: 0,
        durationMs: 0,
      });

      const id2 = mockCreate.mock.calls[0][0].data.id;
      expect(id1).not.toBe(id2);
    });
  });
});
