import { prisma, checkBudgetForNewTask } from "@spoke/db";

export const dynamic = "force-dynamic";

const DEFAULT_COST_CAP_USD = Number(process.env.DEFAULT_COST_CAP_USD ?? "5.00");

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { created_at: "desc" },
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const { goal, repo_url, team_id, cost_cap_usd } = await request.json();
  if (!goal || !repo_url) {
    return new Response("goal and repo_url are required", { status: 400 });
  }

  const cap = Number(cost_cap_usd ?? DEFAULT_COST_CAP_USD);

  const budget = await checkBudgetForNewTask(team_id, cap);
  if (!budget.allowed) {
    return Response.json(
      { error: "team_budget_exhausted", message: budget.reason, remaining: budget.remaining, budget: budget.budget },
      { status: 402 },
    );
  }

  const task = await prisma.task.create({
    data: {
      id: crypto.randomUUID(),
      goal,
      repo_url,
      branch_target: `spoke/${Date.now().toString(36)}`,
      status: "pending",
      cost_cap_usd: cap,
      ...(team_id ? { team_id } : {}),
      created_by: "demo",
    },
  });

  return Response.json(task, { status: 201 });
}
