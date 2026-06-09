import { prisma, Prisma } from '@spoke/db';
import { randomUUID } from 'node:crypto';

export async function writeProvenance(data: {
  taskRunId: string;
  type: string;
  payload: Record<string, unknown>;
  costUsd: number;
  tokens: number;
  durationMs: number;
}): Promise<void> {
  await prisma.provenance.create({
    data: {
      id: randomUUID(),
      task_run_id: data.taskRunId,
      type: data.type,
      payload: data.payload as Prisma.InputJsonValue,
      cost_usd: data.costUsd,
      tokens: data.tokens,
      duration_ms: data.durationMs,
    },
  });
}
