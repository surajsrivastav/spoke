import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../../activities/index.js';
import type { CleanupInput, CleanupOutput } from '../orchestrator-types.js';

const { destroySandbox } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

export async function cleanupSubAgent(input: CleanupInput): Promise<CleanupOutput> {
  const { sandboxId } = input;
  await destroySandbox(sandboxId);
  return { ok: true };
}
