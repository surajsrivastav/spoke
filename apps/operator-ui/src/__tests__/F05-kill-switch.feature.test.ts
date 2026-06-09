import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@harness/db';
import { POST } from '../app/api/tasks/[id]/kill/route';

vi.mock('@harness/db', () => ({
  prisma: {
    task: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('F-05: Operator UI & Kill Switch — Acceptance Criteria', () => {
  describe('✅ Happy path — kill a running task', () => {
    it('sets status to killed and returns ok', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({ id: 'task-1', status: 'killed' } as any);

      const res = await POST(
        new Request('http://localhost:3000/api/tasks/task-1/kill'),
        { params: { id: 'task-1' } },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'killed' },
      });
    });
  });

  describe('❌ Sad paths', () => {
    it('returns error when task does not exist', async () => {
      vi.mocked(prisma.task.update).mockRejectedValue(new Error('Record to update not found'));

      await expect(
        POST(new Request('http://localhost:3000/api/tasks/nonexistent/kill'), { params: { id: 'nonexistent' } }),
      ).rejects.toThrow('Record to update not found');
    });

    it('handles database connectivity failure', async () => {
      vi.mocked(prisma.task.update).mockRejectedValue(new Error('db connection failed'));

      await expect(
        POST(new Request('http://localhost:3000/api/tasks/1/kill'), { params: { id: '1' } }),
      ).rejects.toThrow('db connection failed');
    });
  });

  describe('⚠️ Edge cases', () => {
    it('allows killing a task that is already completed', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({ id: '1', status: 'killed' } as any);

      const res = await POST(
        new Request('http://localhost:3000/api/tasks/1/kill'),
        { params: { id: '1' } },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('allows killing a task that is already killed', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({ id: '1', status: 'killed' } as any);

      const res = await POST(
        new Request('http://localhost:3000/api/tasks/1/kill'),
        { params: { id: '1' } },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'killed' },
      });
    });

    it('handles malformed task ID gracefully', async () => {
      vi.mocked(prisma.task.update).mockRejectedValue(new Error('Invalid task ID format'));

      await expect(
        POST(new Request('http://localhost:3000/api/tasks/ /kill'), { params: { id: ' ' } }),
      ).rejects.toThrow('Invalid task ID format');
    });

    it('kill of pending task (never started) succeeds', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({ id: 'pending-task', status: 'killed' } as any);

      const res = await POST(
        new Request('http://localhost:3000/api/tasks/pending-task/kill'),
        { params: { id: 'pending-task' } },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'pending-task' },
        data: { status: 'killed' },
      });
    });
  });
});
