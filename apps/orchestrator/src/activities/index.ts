import { prisma } from '@spoke/db';
import type { TaskStatus } from '@spoke/shared';
import { env } from '@spoke/shared';
import { randomUUID } from 'node:crypto';
import { ApplicationFailure } from '@temporalio/activity';
import {
  provisionSandbox as realProvisionSandbox,
  destroySandbox as realDestroySandbox,
  runAgentLoop,
  runVerification,
  pushBranch as realPushBranch,
  createPr as realCreatePr,
  executeShell,
  CostCapExceededError,
} from '@spoke/agent';
import { writeProvenance } from '@spoke/provenance';

const TERMINAL_STATUSES: TaskStatus[] = ['succeeded', 'failed', 'killed'];

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<{ ok: true }> {
  console.log(`[activity] updateTaskStatus: taskId=${taskId}, status=${status}`);
  if (status === 'succeeded') {
    await prisma.task.updateMany({
      where: { id: taskId, status: { not: 'killed' } },
      data: { status, completed_at: new Date() },
    });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { status, ...(TERMINAL_STATUSES.includes(status) ? { completed_at: new Date() } : {}) },
    });
  }
  if (TERMINAL_STATUSES.includes(status)) {
    await prisma.taskRun.updateMany({
      where: { task_id: taskId, ended_at: null },
      data: { status, ended_at: new Date() },
    }).catch(() => {});
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

function normalizeRepoUrl(repoUrl: string): string {
  if (repoUrl.startsWith('http://') || repoUrl.startsWith('https://') || repoUrl.startsWith('git@')) {
    return repoUrl;
  }
  const parts = repoUrl.split('/');
  if (parts.length === 2) {
    return `https://github.com/${parts[0]}/${parts[1]}.git`;
  }
  return repoUrl;
}

export async function cloneRepo(sandboxId: string, repoUrl: string, taskRunId: string): Promise<{ ok: true }> {
  console.log(`[activity] cloneRepo: sandboxId=${sandboxId}, taskRunId=${taskRunId}`);
  const fullUrl = normalizeRepoUrl(repoUrl);
  const authUrl = fullUrl.replace('https://', `https://oauth2:${env.GH_TOKEN}@`);
  await executeShell(sandboxId, `git clone ${authUrl} /repo`);
  await executeShell(sandboxId, 'cd /repo && git remote set-url origin ' + fullUrl);
  await executeShell(sandboxId, 'cd /repo && git config user.name "Spoke Agent" && git config user.email "spoke@agent.dev"');
  return { ok: true };
}

export async function runAgent(
  sandboxId: string,
  goal: string,
  taskRunId: string,
  prevErrors?: Record<string, unknown>,
  taskId?: string,
): Promise<{ result: string }> {
  console.log(`[activity] runAgent: sandboxId=${sandboxId}, taskRunId=${taskRunId}`);

  let costCap: number | undefined;
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task) costCap = Number(task.cost_cap_usd);
  }

  const t0 = Date.now();
  try {
    const { result, totalTokens, totalCost } = await runAgentLoop(sandboxId, goal, taskRunId, prevErrors, costCap);

    await recordAgentCost(taskRunId, taskId, totalCost, totalTokens);
    await writeProvenance({
      taskRunId,
      type: 'tool_called',
      payload: { action: 'agent_run', result: result.slice(0, 500) },
      costUsd: totalCost,
      tokens: totalTokens,
      durationMs: Date.now() - t0,
    });

    return { result };
  } catch (err) {
    if (err instanceof CostCapExceededError) {
      await recordAgentCost(taskRunId, taskId, err.currentCost, 0);
      if (taskId) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'failed', failure_reason: 'cost_cap_exceeded' },
        }).catch(() => {});
      }
      await writeProvenance({
        taskRunId,
        type: 'cost_cap_exceeded',
        payload: { current_cost: err.currentCost, cap: err.cap },
        costUsd: err.currentCost,
        tokens: 0,
        durationMs: Date.now() - t0,
      }).catch(() => {});
      throw ApplicationFailure.nonRetryable(err.message, 'CostCapExceededError');
    }
    throw err;
  }
}

async function recordAgentCost(
  taskRunId: string,
  taskId: string | undefined,
  costUsd: number,
  tokens: number,
): Promise<void> {
  await prisma.taskRun.update({
    where: { id: taskRunId },
    data: {
      total_cost_usd: { increment: costUsd },
      total_tokens: { increment: tokens },
    },
  }).catch(() => {});
  if (taskId) {
    await prisma.task.update({
      where: { id: taskId },
      data: { total_cost_usd: { increment: costUsd } },
    }).catch(() => {});
  }
  await prisma.trace.create({
    data: {
      id: randomUUID(),
      task_run_id: taskRunId,
      type: 'model_call',
      model: env.DEFAULT_MODEL,
      input: { taskId },
      output: {},
      tokens_in: tokens,
      tokens_out: 0,
      cost_usd: costUsd,
    },
  }).catch(() => {});
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
