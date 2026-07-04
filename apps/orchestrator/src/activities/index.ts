import { prisma } from '@spoke/db';
import type { TaskStatus } from '@spoke/shared';
import { env } from '@spoke/shared';
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
