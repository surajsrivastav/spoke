import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import type { AgentRunResult } from '@spoke/shared';

const {
  updateTaskStatus,
  provisionSandbox,
  cloneRepo,
  runAgent,
  verify,
  pushBranch,
  createPr,
  destroySandbox,
  createExecutionPlan,
  getDiffSize,
  aggregateResults,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

const killSignal = defineSignal('kill');
let cancelled = false;

export interface SpokeIntentInput {
  taskId: string;
  goal: string;
  repoUrl: string;
}

async function checkCancelled(taskId: string): Promise<boolean> {
  if (cancelled) {
    await updateTaskStatus(taskId, 'killed');
    return true;
  }
  return false;
}

export async function spokeIntentWorkflow(input: SpokeIntentInput): Promise<{ ok: true }> {
  const { taskId, goal, repoUrl } = input;
  const provisionedSandboxIds: string[] = [];

  setHandler(killSignal, () => {
    cancelled = true;
  });

  try {
    await updateTaskStatus(taskId, 'running');
    if (await checkCancelled(taskId)) return { ok: true };

    // Step 1: Create execution plan (rule-based, no ML)
    const plan = await createExecutionPlan(taskId, goal, repoUrl);
    if (await checkCancelled(taskId)) return { ok: true };

    // Step 2: Provision all sandboxes up-front so we can clean them up reliably
    const provisions: Array<{ sandboxId: string; taskRunId: string }> = [];
    for (let i = 0; i < plan.agent_count; i++) {
      const p = await provisionSandbox(taskId);
      provisions.push(p);
      provisionedSandboxIds.push(p.sandboxId);
    }
    if (await checkCancelled(taskId)) return { ok: true };

    // Step 3: Fan-out — clone and run each agent branch in parallel
    async function runAgentBranch(
      provision: { sandboxId: string; taskRunId: string },
    ): Promise<AgentRunResult> {
      await cloneRepo(provision.sandboxId, repoUrl, provision.taskRunId);

      let passed = false;
      let prevErrors: Record<string, unknown> | undefined;

      for (let attempt = 0; attempt < 3; attempt++) {
        await runAgent(provision.sandboxId, goal, provision.taskRunId, prevErrors);
        const verResult = await verify(provision.sandboxId, provision.taskRunId);
        if (verResult.passed) {
          passed = true;
          break;
        }
        prevErrors = verResult.errors;
      }

      const { size: diffSize } = await getDiffSize(provision.sandboxId);
      const confidence = passed ? Math.max(0.5, 0.9 - diffSize / 10000) : 0;

      return {
        taskRunId: provision.taskRunId,
        sandboxId: provision.sandboxId,
        passed,
        confidence,
        diffSize,
      };
    }

    const settled = await Promise.allSettled(provisions.map(p => runAgentBranch(p)));
    if (await checkCancelled(taskId)) return { ok: true };

    // Step 4: Collect results — failed branches return a zero-confidence result
    const results: AgentRunResult[] = settled.map((s, i) =>
      s.status === 'fulfilled'
        ? s.value
        : { taskRunId: provisions[i].taskRunId, sandboxId: provisions[i].sandboxId, passed: false, confidence: 0, diffSize: 0 },
    );

    // Step 5: Aggregate — pick best result
    const best = await aggregateResults(taskId, results);

    if (!best) {
      await updateTaskStatus(taskId, 'failed');
      return { ok: true };
    }

    // Step 6: Push branch and create PR from winner's sandbox
    const { branch } = await pushBranch(best.sandboxId, repoUrl, goal, best.taskRunId, taskId);
    if (await checkCancelled(taskId)) return { ok: true };

    await createPr(repoUrl, branch, goal, best.taskRunId, taskId);
    if (await checkCancelled(taskId)) return { ok: true };

    await updateTaskStatus(taskId, 'succeeded');
    return { ok: true };
  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {});
    throw err;
  } finally {
    for (const sandboxId of provisionedSandboxIds) {
      await destroySandbox(sandboxId).catch(() => {});
    }
  }
}
