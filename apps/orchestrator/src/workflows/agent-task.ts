import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

const { updateTaskStatus, provisionSandbox, cloneRepo, runAgent, verify, pushBranch, createPr, destroySandbox } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
    retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
  });

const killSignal = defineSignal('kill');
let cancelled = false;

export interface AgentTaskInput {
  taskId: string;
  goal: string;
  repoUrl: string;
}

async function checkCancelled(taskId: string): Promise<{ killed: true } | null> {
  if (cancelled) {
    await updateTaskStatus(taskId, 'killed');
    return { killed: true };
  }
  return null;
}

export async function agentTaskWorkflow(input: AgentTaskInput): Promise<{ ok: true }> {
  const { taskId, goal, repoUrl } = input;
  let sandboxId: string | undefined;

  setHandler(killSignal, () => {
    cancelled = true;
  });

  try {
    await updateTaskStatus(taskId, 'running');

    if (await checkCancelled(taskId)) return { ok: true };

    const provisionResult = await provisionSandbox(taskId);
    sandboxId = provisionResult.sandboxId;

    await cloneRepo(sandboxId, repoUrl, provisionResult.taskRunId);

    if (await checkCancelled(taskId)) return { ok: true };

    let verificationPassed = false;
    let prevErrors: Record<string, unknown> | undefined;
    let agentResult: { result: string } = { result: '' };

    for (let attempt = 0; attempt < 3; attempt++) {
      agentResult = await runAgent(sandboxId, goal, provisionResult.taskRunId, prevErrors);

      if (await checkCancelled(taskId)) return { ok: true };

      const verResult = await verify(sandboxId, provisionResult.taskRunId);

      if (await checkCancelled(taskId)) return { ok: true };

      if (verResult.passed) {
        verificationPassed = true;
        break;
      }

      prevErrors = verResult.errors;
    }

    if (!verificationPassed) {
      await updateTaskStatus(taskId, 'failed');
      return { ok: true };
    }

    const { branch } = await pushBranch(sandboxId, repoUrl, goal, provisionResult.taskRunId, taskId);

    if (await checkCancelled(taskId)) return { ok: true };

    await createPr(repoUrl, branch, goal, provisionResult.taskRunId, taskId, agentResult.result);

    if (await checkCancelled(taskId)) return { ok: true };

    await updateTaskStatus(taskId, 'succeeded');

    return { ok: true };
  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {});
    throw err;
  } finally {
    if (sandboxId) {
      await destroySandbox(sandboxId).catch(() => {});
    }
  }
}
