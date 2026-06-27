import { prisma } from '@spoke/db';
import type { TaskStatus, AgentRunResult, ExecutionPlan } from '@spoke/shared';
import { env, parseIntent, createPlan } from '@spoke/shared';
import { randomUUID } from 'node:crypto';
import {
  provisionSandbox as realProvisionSandbox,
  destroySandbox as realDestroySandbox,
  runAgentLoop,
  runVerification,
  pushBranch as realPushBranch,
  createPr as realCreatePr,
  executeShell,
} from '@spoke/agent';
import { writeProvenance } from '@spoke/provenance';

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<{ ok: true }> {
  console.log(`[activity] updateTaskStatus: taskId=${taskId}, status=${status}`);
  if (status === 'succeeded') {
    await prisma.task.updateMany({
      where: { id: taskId, status: { not: 'killed' } },
      data: { status },
    });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });
  }
  return { ok: true };
}

export async function provisionSandbox(taskId: string): Promise<{ sandboxId: string; taskRunId: string }> {
  const taskRunId = randomUUID();
  console.log(`[activity] provisionSandbox: taskId=${taskId}, taskRunId=${taskRunId}`);

  await prisma.taskRun.create({
    data: {
      id: taskRunId,
      task_id: taskId,
      attempt: 1,
      workflow_id: 'agent-task',
      status: 'provisioning',
    },
  });

  const { sandboxId } = await realProvisionSandbox();

  const t0 = Date.now();
  await writeProvenance({
    taskRunId,
    type: 'tool_called',
    payload: { action: 'provision_sandbox', sandboxId },
    costUsd: 0,
    tokens: 0,
    durationMs: Date.now() - t0,
  });

  return { sandboxId, taskRunId };
}

export async function cloneRepo(sandboxId: string, repoUrl: string, taskRunId: string): Promise<{ ok: true }> {
  console.log(`[activity] cloneRepo: sandboxId=${sandboxId}, taskRunId=${taskRunId}`);
  const authUrl = repoUrl.replace('https://', `https://oauth2:${env.GH_TOKEN}@`);
  await executeShell(sandboxId, `git clone ${authUrl} /repo`);
  await executeShell(sandboxId, 'cd /repo && git remote set-url origin ' + repoUrl);
  await executeShell(sandboxId, 'cd /repo && git config user.name "Spoke Agent" && git config user.email "spoke@agent.dev"');
  return { ok: true };
}

export async function runAgent(
  sandboxId: string,
  goal: string,
  taskRunId: string,
  prevErrors?: Record<string, unknown>,
): Promise<{ result: string }> {
  console.log(`[activity] runAgent: sandboxId=${sandboxId}, taskRunId=${taskRunId}`);

  const t0 = Date.now();
  const { result, totalTokens, totalCost } = await runAgentLoop(sandboxId, goal, taskRunId, prevErrors);

  await writeProvenance({
    taskRunId,
    type: 'tool_called',
    payload: { action: 'agent_run', result: result.slice(0, 500) },
    costUsd: totalCost,
    tokens: totalTokens,
    durationMs: Date.now() - t0,
  });

  return { result };
}

export async function verify(
  sandboxId: string,
  taskRunId: string,
): Promise<{ passed: boolean; errors: Record<string, unknown> }> {
  console.log(`[activity] verify: sandboxId=${sandboxId}`);

  const t0 = Date.now();
  const result = await runVerification(sandboxId);

  await writeProvenance({
    taskRunId,
    type: 'verification_run',
    payload: { passed: result.passed, errors: result.errors },
    costUsd: 0,
    tokens: 0,
    durationMs: Date.now() - t0,
  });

  return { passed: result.passed, errors: result.errors as Record<string, unknown> };
}

export async function pushBranch(
  sandboxId: string,
  repoUrl: string,
  goal: string,
  taskRunId: string,
  taskId: string,
): Promise<{ branch: string }> {
  console.log(`[activity] pushBranch: sandboxId=${sandboxId}, taskRunId=${taskRunId}`);

  const t0 = Date.now();
  const { branch } = await realPushBranch(sandboxId, repoUrl, goal, taskId);

  await writeProvenance({
    taskRunId,
    type: 'commit_made',
    payload: { branch, sandboxId },
    costUsd: 0,
    tokens: 0,
    durationMs: Date.now() - t0,
  });

  return { branch };
}

export async function createPr(
  repoUrl: string,
  branch: string,
  goal: string,
  taskRunId: string,
  taskId: string,
  description?: string,
): Promise<{ prUrl: string }> {
  console.log(`[activity] createPr: branch=${branch}, goal=${goal}`);

  const t0 = Date.now();
  const { prUrl, prNumber } = await realCreatePr(repoUrl, branch, goal, description);

  await prisma.pullRequest.create({
    data: {
      id: randomUUID(),
      task_id: taskId,
      github_url: prUrl,
      number: prNumber,
      state: 'open',
    },
  });

  await writeProvenance({
    taskRunId,
    type: 'pr_opened',
    payload: { branch, goal, prUrl },
    costUsd: 0,
    tokens: 0,
    durationMs: Date.now() - t0,
  });

  return { prUrl };
}

export async function killTask(taskId: string): Promise<{ ok: true }> {
  console.log(`[activity] killTask: taskId=${taskId}`);
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'killed' },
  });
  return { ok: true };
}

export async function destroySandbox(sandboxId: string): Promise<{ ok: true }> {
  console.log(`[activity] destroySandbox: sandboxId=${sandboxId}`);
  await realDestroySandbox(sandboxId);
  return { ok: true };
}

export async function createExecutionPlan(
  taskId: string,
  goal: string,
  repoUrl: string,
): Promise<ExecutionPlan> {
  console.log(`[activity] createExecutionPlan: taskId=${taskId}`);

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const maxAgents = task.max_agents ?? 5;

  const intent = parseIntent(taskId, goal, repoUrl, {
    max_agents: maxAgents,
    budget: Number(task.cost_cap_usd),
  });
  const plan = createPlan(intent);

  await prisma.task.update({
    where: { id: taskId },
    data: { strategy: plan.strategy },
  });

  const t0 = Date.now();
  const taskRuns = await prisma.taskRun.findMany({ where: { task_id: taskId }, take: 1 });
  if (taskRuns.length > 0) {
    await writeProvenance({
      taskRunId: taskRuns[0].id,
      type: 'plan_created',
      payload: { strategy: plan.strategy, agent_count: plan.agent_count, rationale: plan.rationale },
      costUsd: 0,
      tokens: 0,
      durationMs: Date.now() - t0,
    });
  }

  console.log(`[activity] plan: strategy=${plan.strategy}, agents=${plan.agent_count} — ${plan.rationale}`);
  return plan;
}

export async function getDiffSize(sandboxId: string): Promise<{ size: number }> {
  console.log(`[activity] getDiffSize: sandboxId=${sandboxId}`);
  try {
    const result = await executeShell(sandboxId, 'cd /repo && git diff HEAD | wc -l');
    const size = parseInt(String(result).trim(), 10) || 0;
    return { size };
  } catch {
    return { size: 0 };
  }
}

export async function aggregateResults(
  taskId: string,
  results: AgentRunResult[],
): Promise<AgentRunResult | null> {
  console.log(`[activity] aggregateResults: taskId=${taskId}, candidates=${results.length}`);

  const passing = results.filter(r => r.passed);

  let winner: AgentRunResult | null = null;
  let reason: string;

  if (passing.length === 0) {
    reason = 'all agents failed verification';
  } else if (passing.length === 1) {
    winner = passing[0];
    reason = 'single passing agent accepted';
  } else {
    winner = passing.reduce((best, r) =>
      r.confidence > best.confidence ? r : best,
    );
    reason = `selected highest confidence (${winner.confidence.toFixed(2)}) from ${passing.length} passing agents`;
  }

  console.log(`[activity] aggregation decision: ${reason}${winner ? `, winner=${winner.taskRunId}` : ''}`);

  const taskRuns = await prisma.taskRun.findMany({ where: { task_id: taskId }, take: 1 });
  if (taskRuns.length > 0) {
    await writeProvenance({
      taskRunId: taskRuns[0].id,
      type: 'plan_created',
      payload: { event: 'aggregation', reason, winner_run_id: winner?.taskRunId ?? null, total_candidates: results.length, passing_count: passing.length },
      costUsd: 0,
      tokens: 0,
      durationMs: 0,
    });
  }

  return winner;
}
