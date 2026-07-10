import { prisma } from './index';

export interface BudgetCheck {
  allowed: boolean;
  remaining: number;
  budget: number;
  spent: number;
  reason?: string;
}

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Sum of task costs for the current calendar month, optionally scoped to a team. */
export async function getMonthlySpend(teamId?: string | null): Promise<number> {
  const result = await prisma.task.aggregate({
    _sum: { total_cost_usd: true },
    where: {
      created_at: { gte: startOfMonth() },
      ...(teamId ? { team_id: teamId } : {}),
    },
  });
  return Number(result._sum.total_cost_usd ?? 0);
}

/**
 * Check whether a new task with the given cost cap fits in the team's
 * monthly budget. Tasks without a team (OSS default) are always allowed.
 */
export async function checkBudgetForNewTask(
  teamId: string | null | undefined,
  taskCapUsd: number,
): Promise<BudgetCheck> {
  if (!teamId) {
    return { allowed: true, remaining: Infinity, budget: Infinity, spent: 0 };
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return { allowed: true, remaining: Infinity, budget: Infinity, spent: 0 };
  }

  const budget = Number(team.monthly_budget_usd);
  const spent = await getMonthlySpend(teamId);
  const remaining = budget - spent;

  if (remaining < taskCapUsd) {
    return {
      allowed: false,
      remaining,
      budget,
      spent,
      reason: `Team budget nearly exhausted ($${remaining.toFixed(2)} remaining). Reduce the task cap or request a budget increase.`,
    };
  }

  return { allowed: true, remaining, budget, spent };
}
