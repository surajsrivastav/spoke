import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, checkBudgetForNewTask } from '@spoke/db';
import { POST } from '../app/api/tasks/route';
import { GET as getCosts } from '../app/api/costs/route';

vi.mock('@spoke/db', () => ({
  prisma: {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    trace: {
      findMany: vi.fn(),
    },
  },
  checkBudgetForNewTask: vi.fn(),
}));

function taskRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('F-07: Cost Governance — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ Happy path — task within budget is accepted', () => {
    it('creates the task with its cost cap when the budget allows it', async () => {
      vi.mocked(checkBudgetForNewTask).mockResolvedValue({
        allowed: true, remaining: 494, budget: 500, spent: 6,
      });
      vi.mocked(prisma.task.create).mockImplementation((async (args: { data: Record<string, unknown> }) => args.data) as never);

      const res = await POST(taskRequest({ goal: 'Add dark mode', repo_url: 'https://github.com/org/repo', team_id: 'team-platform' }));

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.cost_cap_usd).toBe(5);
      expect(body.team_id).toBe('team-platform');
      expect(checkBudgetForNewTask).toHaveBeenCalledWith('team-platform', 5);
    });

    it('honours an explicit per-task cost cap', async () => {
      vi.mocked(checkBudgetForNewTask).mockResolvedValue({
        allowed: true, remaining: 100, budget: 100, spent: 0,
      });
      vi.mocked(prisma.task.create).mockImplementation((async (args: { data: Record<string, unknown> }) => args.data) as never);

      const res = await POST(taskRequest({ goal: 'Big refactor', repo_url: 'https://github.com/org/repo', cost_cap_usd: 12 }));

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.cost_cap_usd).toBe(12);
    });
  });

  describe('❌ Sad path — team monthly budget is exhausted', () => {
    it('rejects the task and creates nothing in the database', async () => {
      vi.mocked(checkBudgetForNewTask).mockResolvedValue({
        allowed: false,
        remaining: 3,
        budget: 200,
        spent: 197,
        reason: 'Team budget nearly exhausted ($3.00 remaining). Reduce the task cap or request a budget increase.',
      });

      const res = await POST(taskRequest({ goal: 'refactor the entire auth module', repo_url: 'https://github.com/org/repo', team_id: 'team-platform' }));

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.error).toBe('team_budget_exhausted');
      expect(body.message).toContain('budget nearly exhausted');
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('⚠️ Edge case — tasks without a team are never budget-blocked (OSS default)', () => {
    it('allows the task when no team is supplied', async () => {
      vi.mocked(checkBudgetForNewTask).mockResolvedValue({
        allowed: true, remaining: Infinity, budget: Infinity, spent: 0,
      });
      vi.mocked(prisma.task.create).mockImplementation((async (args: { data: Record<string, unknown> }) => args.data) as never);

      const res = await POST(taskRequest({ goal: 'Fix bug', repo_url: 'https://github.com/org/repo' }));

      expect(res.status).toBe(201);
      expect(checkBudgetForNewTask).toHaveBeenCalledWith(undefined, 5);
    });
  });

  describe('✅ Cost dashboard — real-time spend visibility', () => {
    it('aggregates month spend, budget, per-model and top task costs', async () => {
      vi.mocked(prisma.task.aggregate).mockResolvedValue({ _sum: { total_cost_usd: 106.2 } } as never);
      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { id: 't1', name: 'Platform', monthly_budget_usd: 500, created_at: new Date() },
      ] as never);
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { id: 'task_01', goal: 'Add JWT auth', total_cost_usd: 4.82, cost_cap_usd: 5, created_by: 'alice', created_at: new Date(), status: 'succeeded' },
      ] as never);
      vi.mocked(prisma.trace.findMany).mockResolvedValue([
        { model: 'claude-sonnet-4', cost_usd: 3.5, created_at: new Date('2026-07-08T10:00:00Z') },
        { model: 'claude-sonnet-4', cost_usd: 1.0, created_at: new Date('2026-07-08T12:00:00Z') },
        { model: 'claude-haiku-4', cost_usd: 0.4, created_at: new Date('2026-07-09T09:00:00Z') },
      ] as never);

      const res = await getCosts(new Request('http://localhost:3000/api/costs?range=30d'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.month_spend).toBe(106.2);
      expect(body.monthly_budget).toBe(500);
      expect(body.by_model).toEqual([
        { model: 'claude-sonnet-4', cost: 4.5 },
        { model: 'claude-haiku-4', cost: 0.4 },
      ]);
      expect(body.daily).toEqual([
        { day: '2026-07-08', cost: 4.5 },
        { day: '2026-07-09', cost: 0.4 },
      ]);
      expect(body.top_tasks[0]).toMatchObject({ id: 'task_01', cost: 4.82, cap: 5 });
    });
  });
});
