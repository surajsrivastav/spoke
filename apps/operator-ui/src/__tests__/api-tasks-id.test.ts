import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@harness/db';
import { GET } from '../app/api/tasks/[id]/route';

vi.mock('@harness/db', () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
    },
  },
}));

describe('GET /api/tasks/[id]', () => {
  it('returns task when found', async () => {
    const mockTask: any = {
      id: '1',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      task_runs: [],
    };
    vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask);

    const req = new Request('http://localhost:3000/api/tasks/1');
    const res = await GET(req, { params: { id: '1' } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(JSON.parse(JSON.stringify(mockTask)));
    expect(prisma.task.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
      include: {
        task_runs: {
          orderBy: { attempt: 'asc' },
          include: { provenances: { orderBy: { created_at: 'asc' } } },
        },
      },
    });
  });

  it('returns 404 when task not found', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/tasks/999');
    const res = await GET(req, { params: { id: '999' } });

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('Not found');
    expect(prisma.task.findUnique).toHaveBeenCalledWith({
      where: { id: '999' },
      include: {
        task_runs: {
          orderBy: { attempt: 'asc' },
          include: { provenances: { orderBy: { created_at: 'asc' } } },
        },
      },
    });
  });

  it('throws when database fails', async () => {
    vi.mocked(prisma.task.findUnique).mockRejectedValue(new Error('db error'));

    const req = new Request('http://localhost:3000/api/tasks/1');
    await expect(GET(req, { params: { id: '1' } })).rejects.toThrow('db error');
  });
});
