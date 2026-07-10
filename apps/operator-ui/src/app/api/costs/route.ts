import { prisma } from "@spoke/db";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "30d";
  const days = RANGE_DAYS[range] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [monthAgg, teams, tasks, traces] = await Promise.all([
    prisma.task.aggregate({
      _sum: { total_cost_usd: true },
      where: { created_at: { gte: monthStart } },
    }),
    prisma.team.findMany(),
    prisma.task.findMany({
      where: { created_at: { gte: since } },
      orderBy: { total_cost_usd: "desc" },
      take: 10,
      select: {
        id: true,
        goal: true,
        total_cost_usd: true,
        cost_cap_usd: true,
        created_by: true,
        created_at: true,
        status: true,
      },
    }),
    prisma.trace.findMany({
      where: { created_at: { gte: since } },
      select: { model: true, cost_usd: true, created_at: true },
    }),
  ]);

  const monthSpend = Number(monthAgg._sum.total_cost_usd ?? 0);
  const monthlyBudget = teams.reduce((sum, t) => sum + Number(t.monthly_budget_usd), 0);

  const byModelMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  for (const trace of traces) {
    const model = trace.model ?? "unknown";
    byModelMap.set(model, (byModelMap.get(model) ?? 0) + Number(trace.cost_usd));
    const day = trace.created_at.toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + Number(trace.cost_usd));
  }

  return Response.json({
    month_spend: monthSpend,
    monthly_budget: monthlyBudget,
    daily: [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ day, cost })),
    by_model: [...byModelMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([model, cost]) => ({ model, cost })),
    top_tasks: tasks.map((t) => ({
      id: t.id,
      goal: t.goal,
      cost: Number(t.total_cost_usd),
      cap: Number(t.cost_cap_usd),
      actor: t.created_by,
      status: t.status,
      created_at: t.created_at,
    })),
  });
}
