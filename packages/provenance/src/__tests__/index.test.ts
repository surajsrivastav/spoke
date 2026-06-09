import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeProvenance } from '../index.js';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@harness/db', () => ({
  prisma: {
    provenance: {
      create: mockCreate,
    },
  },
}));

describe('writeProvenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.provenance.create with correct data', async () => {
    mockCreate.mockResolvedValue(undefined);

    await writeProvenance({
      taskRunId: 'run-123',
      type: 'tool_called',
      payload: { tool: 'read_file', path: '/foo' },
      costUsd: 0.002,
      tokens: 150,
      durationMs: 1200,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0].data;
    expect(callArg.task_run_id).toBe('run-123');
    expect(callArg.type).toBe('tool_called');
    expect(callArg.payload).toEqual({ tool: 'read_file', path: '/foo' });
    expect(callArg.cost_usd).toBe(0.002);
    expect(callArg.tokens).toBe(150);
    expect(callArg.duration_ms).toBe(1200);
    expect(callArg.id).toBeDefined();
    expect(typeof callArg.id).toBe('string');
  });

  it('handles large payloads', async () => {
    mockCreate.mockResolvedValue(undefined);

    const payload = {
      files: Array.from({ length: 100 }, (_, i) => ({ path: `/file-${i}`, content: 'x'.repeat(100) })),
    };
    await writeProvenance({
      taskRunId: 'run-large',
      type: 'model_response',
      payload,
      costUsd: 0.5,
      tokens: 5000,
      durationMs: 30000,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].data.payload).toEqual(payload);
  });

  it('propagates error when prisma.provenance.create fails', async () => {
    const error = new Error('DB connection failed');
    mockCreate.mockRejectedValue(error);

    await expect(
      writeProvenance({
        taskRunId: 'run-456',
        type: 'plan_created',
        payload: {},
        costUsd: 0.0,
        tokens: 0,
        durationMs: 0,
      }),
    ).rejects.toThrow('DB connection failed');
  });
});
