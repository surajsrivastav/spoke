import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../../activities/index.js';
import type { VerifyInput, VerifyOutput } from '../orchestrator-types.js';

const { verify } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10 seconds', maximumAttempts: 3 },
});

export async function verifySubAgent(input: VerifyInput): Promise<VerifyOutput> {
  const { sandboxId, taskRunId } = input;
  const result = await verify(sandboxId, taskRunId);
  return { ok: true, passed: result.passed, errors: result.errors };
}
