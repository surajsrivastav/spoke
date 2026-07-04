import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../../activities/index.js';
import type { GitHubInput, GitHubOutput } from '../orchestrator-types.js';

const { pushBranch, createPr, updateTaskStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

export async function githubSubAgent(input: GitHubInput): Promise<GitHubOutput> {
  const { sandboxId, repoUrl, goal, taskRunId, taskId, agentResult } = input;

  const { branch } = await pushBranch(sandboxId, repoUrl, goal, taskRunId, taskId);
  const { prUrl } = await createPr(repoUrl, branch, goal, taskRunId, taskId, agentResult);
  await updateTaskStatus(taskId, 'succeeded');

  return { ok: true, branch, prUrl };
}
