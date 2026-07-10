import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@spoke/db';
import { GET } from '../app/api/tasks/route';

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  checkBudgetForNewTask: vi.fn().mockResolvedValue({ allowed: true, remaining: Infinity, budget: Infinity, spent: 0 }),
}));

describe('GET /api/tasks', () => {
  it('returns JSON array of tasks', async () => {
    const mockTasks: any[] = [
      { id: '1', status: 'pending', created_at: new Date(), updated_at: new Date() },
      { id: '2', status: 'running', created_at: new Date(), updated_at: new Date() },
    ];
    vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual(JSON.parse(JSON.stringify(mockTasks)));
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      orderBy: { created_at: 'desc' },
    });
  });

  it('returns empty array when no tasks exist', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('throws when database fails', async () => {
    vi.mocked(prisma.task.findMany).mockRejectedValue(new Error('db error'));

    await expect(GET()).rejects.toThrow('db error');
  });
});
