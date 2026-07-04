import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../../activities/index.js';
import type { ExecuteInput, ExecuteOutput } from '../orchestrator-types.js';

const { runAgent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

export async function executeSubAgent(input: ExecuteInput): Promise<ExecuteOutput> {
  const { sandboxId, goal, taskRunId, prevErrors } = input;
  const { result } = await runAgent(sandboxId, goal, taskRunId, prevErrors);
  return { ok: true, result };
}
