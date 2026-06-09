import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@spoke/db';
import { GET } from '../app/api/events/route';

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
    },
  },
}));

describe('GET /api/events', () => {
  it('returns SSE-formatted response with proper headers', async () => {
    const mockTasks: any[] = [
      { id: '1', status: 'pending', created_at: new Date(), updated_at: new Date() },
    ];
    vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks);

    const controller = new AbortController();
    const request = new Request('http://localhost:3000/api/events', {
      signal: controller.signal,
    });

    const res = await GET(request);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');

    const reader = res.body!.getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(value).toBeDefined();

    const text = new TextDecoder().decode(value);
    expect(text).toContain('data: ');
    expect(text).toContain('"type":"init"');
    expect(text).toContain('"tasks"');

    expect(prisma.task.findMany).toHaveBeenCalledWith({
      orderBy: { created_at: 'desc' },
    });

    controller.abort();

    const closed = await reader.read();
    expect(closed.done).toBe(true);
  });

  it('returns SSE with empty tasks array when no tasks exist', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const controller = new AbortController();
    const request = new Request('http://localhost:3000/api/events', {
      signal: controller.signal,
    });

    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(value).toBeDefined();
    const text = new TextDecoder().decode(value);

    expect(text).toContain('"tasks":[]');

    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it('sends update events when tasks change during polling', async () => {
    vi.useFakeTimers();

    const oldDate = new Date('2024-01-01T00:00:00Z');
    const newDate = new Date('2024-01-02T00:00:00Z');

    const initialTasks: any[] = [
      { id: '1', status: 'pending', created_at: oldDate, updated_at: oldDate },
    ];
    const updatedTasks: any[] = [
      { id: '1', status: 'running', created_at: oldDate, updated_at: newDate },
    ];

    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce(initialTasks)
      .mockResolvedValueOnce(updatedTasks);

    const controller = new AbortController();
    const request = new Request('http://localhost:3000/api/events', {
      signal: controller.signal,
    });

    const res = await GET(request);
    const reader = res.body!.getReader();

    const { value: initVal } = await reader.read();
    const initText = new TextDecoder().decode(initVal);
    expect(initText).toContain('"type":"init"');
    expect(initText).toContain('"status":"pending"');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    const { value: updateVal } = await reader.read();
    const updateText = new TextDecoder().decode(updateVal);
    expect(updateText).toContain('"type":"update"');
    expect(updateText).toContain('"status":"running"');

    const callArgs = (prisma.task.findMany as any).mock.calls.map((c: any[]) => c[0]);
    callArgs.forEach((args: any) => {
      expect(args).toEqual({ orderBy: { created_at: 'desc' } });
    });

    controller.abort();
    vi.useRealTimers();
  });

  it('does not send update when tasks have not changed', async () => {
    vi.useFakeTimers();

    const tasks: any[] = [
      { id: '1', status: 'pending', created_at: new Date('2024-01-01T00:00:00Z'), updated_at: new Date('2024-01-01T00:00:00Z') },
    ];

    vi.mocked(prisma.task.findMany).mockResolvedValue(tasks);

    const controller = new AbortController();
    const request = new Request('http://localhost:3000/api/events', {
      signal: controller.signal,
    });

    const res = await GET(request);
    const reader = res.body!.getReader();

    await reader.read();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    const result = await Promise.race([
      reader.read().then(() => 'got-data'),
      new Promise<'no-data'>((resolve) => queueMicrotask(() => resolve('no-data'))),
    ]);
    expect(result).toBe('no-data');

    controller.abort();
    vi.useRealTimers();
  });

  it('handles db error during polling gracefully', async () => {
    vi.useFakeTimers();

    const tasks: any[] = [
      { id: '1', updated_at: new Date('2024-01-01T00:00:00Z') },
    ];

    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce(tasks)
      .mockRejectedValueOnce(new Error('poll error'));

    const controller = new AbortController();
    const request = new Request('http://localhost:3000/api/events', {
      signal: controller.signal,
    });

    const res = await GET(request);
    const reader = res.body!.getReader();

    await reader.read();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    vi.mocked(prisma.task.findMany).mockResolvedValue(tasks);

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    const result = await Promise.race([
      reader.read().then(() => 'got-data'),
      new Promise<'no-data'>((resolve) => queueMicrotask(() => resolve('no-data'))),
    ]);
    expect(result).toBe('no-data');

    controller.abort();
    vi.useRealTimers();
  });
});
