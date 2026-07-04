import { executeChild, setHandler, defineSignal, defineQuery, proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import type {
  OrchestratorInput,
  SubAgentState,
  SubAgentType,
  SetupOutput,
  ExecuteOutput,
  VerifyOutput,
  GitHubOutput,
} from './orchestrator-types.js';

const { updateTaskStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

const killSignal = defineSignal('kill');
const subAgentsQuery = defineQuery<SubAgentState[]>('getSubAgents');

const MAX_VERIFICATION_ATTEMPTS = 3;

export async function orchestratorWorkflow(input: OrchestratorInput): Promise<{ ok: boolean }> {
  const { taskId, goal, repoUrl } = input;
  let cancelled = false;
  let sandboxId: string | undefined;

  setHandler(killSignal, () => {
    cancelled = true;
  });

  const subAgents: SubAgentState[] = [];

  setHandler(subAgentsQuery, () => subAgents.map((a) => ({ ...a })));

  function checkCancelled(): boolean {
    return cancelled;
  }

  function trackAgent(id: string, type: SubAgentType): SubAgentState {
    const agent: SubAgentState = {
      id,
      type,
      status: 'pending',
      attempt: 0,
    };
    subAgents.push(agent);
    return agent;
  }

  function updateAgent(agent: SubAgentState, update: Partial<SubAgentState>): void {
    Object.assign(agent, update);
  }

  async function spawnSubAgent<T extends { ok: boolean }>(
    agent: SubAgentState,
    workflowType: string,
    args: Record<string, unknown>,
    options?: { retryCount?: number },
  ): Promise<T | null> {
    if (checkCancelled()) return null;

    const maxAttempts = options?.retryCount ?? 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (checkCancelled()) return null;

      updateAgent(agent, {
        status: 'running',
        attempt: attempt + 1,
        workflowId: `${taskId}-${agent.id}-v${attempt}`,
      });

      try {
        const result = await executeChild(workflowType, {
          args: [{ ...args, taskId }],
          workflowId: agent.workflowId,
          taskQueue: 'spoke-task-queue',
        });
        updateAgent(agent, {
          status: 'succeeded',
          output: result as Record<string, unknown>,
        });
        return result as T;
      } catch (err) {
        if (checkCancelled()) return null;

        const isLast = attempt >= maxAttempts - 1;
        if (isLast) {
          updateAgent(agent, {
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }
    }
    return null;
  }

  try {
    // ---- Phase 1: Setup ----
    const setupAgent = trackAgent('setup', 'setup');
    const setupResult = await spawnSubAgent<SetupOutput>(
      setupAgent,
      'setupSubAgent',
      { repoUrl },
    );
    if (!setupResult || checkCancelled()) return { ok: false };

    sandboxId = setupResult.sandboxId;
    const taskRunId = setupResult.taskRunId;

    // ---- Phase 2: Execute-Verify loop ----
    let verificationPassed = false;
    let prevErrors: Record<string, unknown> | undefined;
    let agentResult: string = '';

    for (let i = 0; i < MAX_VERIFICATION_ATTEMPTS; i++) {
      if (checkCancelled()) break;

      const execAgent = trackAgent(`execute-${i}`, 'execute');
      const execResult = await spawnSubAgent<ExecuteOutput>(
        execAgent,
        'executeSubAgent',
        { sandboxId, goal, taskRunId, prevErrors },
      );
      if (!execResult || checkCancelled()) break;

      agentResult = execResult.result;

      if (checkCancelled()) break;

      const verifyAgent = trackAgent(`verify-${i}`, 'verify');
      const verResult = await spawnSubAgent<VerifyOutput>(
        verifyAgent,
        'verifySubAgent',
        { sandboxId, taskRunId },
      );
      if (!verResult || checkCancelled()) break;

      if (verResult.passed) {
        verificationPassed = true;
        break;
      }
      prevErrors = verResult.errors;
    }

    // All verification attempts exhausted — fail the task
    if (!verificationPassed) {
      await updateTaskStatus(taskId, 'failed');
      return { ok: false };
    }

    if (checkCancelled()) return { ok: false };

    // ---- Phase 3: GitHub push + PR ----
    const githubAgent = trackAgent('github', 'github');
    const githubResult = await spawnSubAgent<GitHubOutput>(
      githubAgent,
      'githubSubAgent',
      { sandboxId, repoUrl, goal, taskRunId, agentResult },
    );
    if (!githubResult) return { ok: false };

    return { ok: true };
  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {});
    throw err;
  } finally {
    if (sandboxId) {
      const cleanupAgent = trackAgent('cleanup', 'cleanup');
      updateAgent(cleanupAgent, {
        status: 'running',
        attempt: 1,
        workflowId: `${taskId}-cleanup-v0`,
      });
      try {
        const result = await executeChild('cleanupSubAgent', {
          args: [{ sandboxId, taskId }],
          workflowId: `${taskId}-cleanup-v0`,
          taskQueue: 'spoke-task-queue',
        });
        updateAgent(cleanupAgent, {
          status: 'succeeded',
          output: result as Record<string, unknown>,
        });
      } catch {
        updateAgent(cleanupAgent, { status: 'failed' });
      }
    }
  }
}
