import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../../activities/index.js';
import type { SetupInput, SetupOutput } from '../orchestrator-types.js';

const { updateTaskStatus, provisionSandbox, cloneRepo } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

export async function setupSubAgent(input: SetupInput): Promise<SetupOutput> {
  const { taskId, repoUrl } = input;

  await updateTaskStatus(taskId, 'running');
  const { sandboxId, taskRunId } = await provisionSandbox(taskId);
  await cloneRepo(sandboxId, repoUrl, taskRunId);

  return { ok: true, sandboxId, taskRunId };
}
