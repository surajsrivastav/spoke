import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@spoke/db';
import { POST } from '../app/api/tasks/[id]/kill/route';

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@temporalio/client', () => ({
  Connection: {
    connect: vi.fn().mockRejectedValue(new Error('temporal unavailable in tests')),
  },
  Client: vi.fn(),
}));

describe('POST /api/tasks/[id]/kill', () => {
  it('updates task status to killed and returns ok', async () => {
    vi.mocked(prisma.task.update).mockResolvedValue({} as any);

    const req = new Request('http://localhost:3000/api/tasks/1/kill');
    const res = await POST(req, { params: { id: '1' } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: 'killed' },
    });
  });

  it('throws when task does not exist', async () => {
    vi.mocked(prisma.task.update).mockRejectedValue(new Error('Record to update not found'));

    await expect(
      POST(new Request('http://localhost:3000/api/tasks/999/kill'), { params: { id: '999' } }),
    ).rejects.toThrow('Record to update not found');
  });

  it('throws on database errors', async () => {
    vi.mocked(prisma.task.update).mockRejectedValue(new Error('db connection failed'));

    await expect(
      POST(new Request('http://localhost:3000/api/tasks/1/kill'), { params: { id: '1' } }),
    ).rejects.toThrow('db connection failed');
  });

  it('allows killing an already-completed task', async () => {
    vi.mocked(prisma.task.update).mockResolvedValue({} as any);

    const res = await POST(
      new Request('http://localhost:3000/api/tasks/1/kill'),
      { params: { id: '1' } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: 'killed' },
    });
  });
});
