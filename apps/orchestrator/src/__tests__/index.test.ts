import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClientStart, mockConnectionClose } = vi.hoisted(() => ({
  mockClientStart: vi.fn().mockResolvedValue('test-workflow-id'),
  mockConnectionClose: vi.fn(),
}));

vi.mock('@temporalio/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    workflow: { start: mockClientStart },
  })),
}));

vi.mock('@temporalio/worker', () => ({
  NativeConnection: { connect: vi.fn().mockResolvedValue({ close: mockConnectionClose }) },
  Worker: { create: vi.fn().mockResolvedValue({ run: vi.fn() }) },
}));

vi.mock('@spoke/db', () => ({
  prisma: { task: { findMany: vi.fn(), update: vi.fn() }, taskRun: { create: vi.fn() }, pullRequest: { create: vi.fn() } },
}));

import { NativeConnection } from '@temporalio/worker';
import { Client } from '@temporalio/client';
import { startAgentTask } from '../index.js';

describe('startAgentTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a temporal client and starts the workflow, returns workflow ID', async () => {
    const result = await startAgentTask('task-1', 'fix bug', 'https://github.com/org/repo');

    expect(NativeConnection.connect).toHaveBeenCalledWith({ address: 'localhost:7233' });
    expect(Client).toHaveBeenCalledWith(expect.objectContaining({ connection: expect.anything() }));
    expect(mockClientStart).toHaveBeenCalledWith('agentTaskWorkflow', {
      args: [{ taskId: 'task-1', goal: 'fix bug', repoUrl: 'https://github.com/org/repo' }],
      taskQueue: 'spoke-task-queue',
      workflowId: 'agent-task-task-1',
    });
    expect(mockConnectionClose).toHaveBeenCalled();
    expect(result).toBe('agent-task-task-1');
  });

  it('propagates error when temporal client fails', async () => {
    mockClientStart.mockRejectedValueOnce(new Error('Temporal connection refused'));

    await expect(
      startAgentTask('task-1', 'fix bug', 'https://github.com/org/repo'),
    ).rejects.toThrow('Temporal connection refused');
  });
});
