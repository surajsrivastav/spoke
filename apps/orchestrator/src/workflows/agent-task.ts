import { proxyActivities, ApplicationFailure, defineSignal, setHandler } from '@temporalio/workflow';
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

export async function agentTaskWorkflow(input: AgentTaskInput): Promise<{ ok: true }> {
  const { taskId, goal, repoUrl } = input;
  let sandboxId: string | undefined;
  let taskRunId: string | undefined;

  setHandler(killSignal, () => {
    cancelled = true;
  });

  try {
    await updateTaskStatus(taskId, 'running');

    if (cancelled) throw new Error('TaskKilled');

    const provisionResult = await provisionSandbox(taskId);
    sandboxId = provisionResult.sandboxId;
    taskRunId = provisionResult.taskRunId;

    if (cancelled) throw new Error('TaskKilled');

    await cloneRepo(sandboxId, repoUrl, taskRunId);

    if (cancelled) throw new Error('TaskKilled');

    let verificationPassed = false;
    let prevErrors: Record<string, unknown> | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      await runAgent(sandboxId, goal, taskRunId, prevErrors);

      if (cancelled) throw new Error('TaskKilled');

      const verResult = await verify(sandboxId, taskRunId);

      if (cancelled) throw new Error('TaskKilled');

      if (verResult.passed) {
        verificationPassed = true;
        break;
      }

      prevErrors = verResult.errors;
    }

    if (!verificationPassed) {
      throw ApplicationFailure.create({
        message: 'Verification failed after maximum retries',
        type: 'VerificationFailed',
      });
    }

    const { branch } = await pushBranch(sandboxId, repoUrl, goal, taskRunId, taskId);

    if (cancelled) throw new Error('TaskKilled');

    await createPr(repoUrl, branch, goal, taskRunId, taskId);

    await updateTaskStatus(taskId, 'succeeded');

    return { ok: true };
  } catch (err) {
    if (cancelled) {
      await updateTaskStatus(taskId, 'killed').catch(() => {});
    } else {
      await updateTaskStatus(taskId, 'failed').catch(() => {});
    }
    throw ApplicationFailure.create({
      message: `agentTaskWorkflow failed: ${err instanceof Error ? err.message : String(err)}`,
      type: cancelled ? 'TaskKilled' : 'AgentTaskError',
    });
  } finally {
    if (sandboxId) {
      await destroySandbox(sandboxId).catch(() => {});
    }
  }
}
