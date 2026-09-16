import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@spoke/db';
import { POST as killTask } from '../app/api/tasks/[id]/kill/route';
import { GET as getTask } from '../app/api/tasks/[id]/route';
import { can } from '../lib/rbac';

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@temporalio/client', () => ({
  Connection: {
    connect: vi.fn().mockRejectedValue(new Error('temporal unavailable in tests')),
  },
  Client: vi.fn(),
}));

function sessionFor(user: Partial<{ id: string; email: string; role: string; team_id: string | null }>, sessionRole?: string) {
  return {
    token: 'tok-1',
    role: sessionRole ?? user.role ?? 'operator',
    expires_at: new Date(Date.now() + 60_000),
    user: { id: 'u1', email: 'alice@ford.com', name: null, team_id: null, ...user },
  };
}

function killRequest(id: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost:3000/api/tasks/${id}/kill`, {
      method: 'POST',
      headers: { cookie: 'spoke_session=tok-1' },
    }),
    { params: Promise.resolve({ id }) },
  ];
}

describe('F-08: RBAC — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_ENABLED = 'true';
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  });

  afterEach(() => {
    delete process.env.AUTH_ENABLED;
  });

  describe('✅ Happy path — operator kills a task in their team', () => {
    it('allows the kill and records the action in the audit log', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ role: 'operator', team_id: 'team-platform' }) as never,
      );
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: 'task_01', team_id: 'team-platform' } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({} as never);

      const res = await killTask(...killRequest('task_01'));

      expect(res.status).toBe(200);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_01' },
        data: { status: 'killed' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actor: 'alice@ford.com', action: 'KILL_TASK', resource: 'task_01', allowed: true }),
        }),
      );
    });
  });

  describe('❌ Sad path — viewer tries to kill a task', () => {
    it('returns 403 insufficient_permissions and sends no kill', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ email: 'bob@ford.com', role: 'viewer' }) as never,
      );

      const res = await killTask(...killRequest('task_01'));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'insufficient_permissions', required_role: 'operator' });
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actor: 'bob@ford.com', action: 'KILL_TASK_DENIED', allowed: false }),
        }),
      );
    });
  });

  describe('❌ Sad path — operator accesses another team\'s task', () => {
    it('kill of a cross-team task returns 404 (no information disclosure)', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ role: 'operator', team_id: 'team-platform' }) as never,
      );
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: 'task_99', team_id: 'team-frontend' } as never);

      const res = await killTask(...killRequest('task_99'));

      expect(res.status).toBe(404);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('viewing a cross-team task returns 404', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ role: 'operator', team_id: 'team-platform' }) as never,
      );
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: 'task_99', team_id: 'team-frontend', task_runs: [],
      } as never);

      const res = await getTask(
        new Request('http://localhost:3000/api/tasks/task_99', { headers: { cookie: 'spoke_session=tok-1' } }),
        { params: Promise.resolve({ id: 'task_99' }) },
      );

      expect(res.status).toBe(404);
    });

    it('admin can kill any team\'s task', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ role: 'admin', team_id: null }) as never,
      );
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: 'task_99', team_id: 'team-frontend' } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({} as never);

      const res = await killTask(...killRequest('task_99'));

      expect(res.status).toBe(200);
    });
  });

  describe('⚠️ Edge case — role change invalidates the session', () => {
    it('returns 401 and deletes the session when the user role no longer matches', async () => {
      // Alice logged in as operator, admin demoted her to viewer afterwards.
      vi.mocked(prisma.session.findUnique).mockResolvedValue(
        sessionFor({ role: 'viewer' }, 'operator') as never,
      );
      vi.mocked(prisma.session.delete).mockResolvedValue({} as never);

      const res = await killTask(...killRequest('task_01'));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'session_expired' });
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { token: 'tok-1' } });
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('⚠️ OSS default — auth disabled bypasses RBAC entirely', () => {
    it('kill succeeds without a session when AUTH_ENABLED is not set', async () => {
      delete process.env.AUTH_ENABLED;
      vi.mocked(prisma.task.update).mockResolvedValue({} as never);

      const res = await killTask(
        new Request('http://localhost:3000/api/tasks/task_01/kill', { method: 'POST' }),
        { params: Promise.resolve({ id: 'task_01' }) },
      );

      expect(res.status).toBe(200);
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Role permission matrix', () => {
    it('grants and denies actions per role', () => {
      expect(can('admin', 'kill_task')).toBe(true);
      expect(can('admin', 'manage_users')).toBe(true);
      expect(can('operator', 'kill_task')).toBe(true);
      expect(can('operator', 'manage_users')).toBe(false);
      expect(can('viewer', 'view_tasks')).toBe(true);
      expect(can('viewer', 'kill_task')).toBe(false);
      expect(can('unknown-role', 'view_tasks')).toBe(false);
    });
  });
});
