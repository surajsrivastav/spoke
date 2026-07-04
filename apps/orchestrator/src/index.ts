import { Client } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/index.js';
import { env } from '@spoke/shared';

export async function startAgentTask(
  taskId: string,
  goal: string,
  repoUrl: string,
  client?: Client,
): Promise<string> {
  const ownConnection = !client;
  let connection: NativeConnection | undefined;

  if (!client) {
    connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });
    client = new Client({ connection });
  }

  const workflowId = `agent-task-${taskId}`;

  await client.workflow.start('agentTaskWorkflow', {
    args: [{ taskId, goal, repoUrl }],
    taskQueue: 'spoke-task-queue',
    workflowId,
  });

  if (ownConnection && connection) {
    await connection.close();
  }
  return workflowId;
}

export async function startOrchestratorTask(
  taskId: string,
  goal: string,
  repoUrl: string,
  client?: Client,
): Promise<string> {
  const ownConnection = !client;
  let connection: NativeConnection | undefined;

  if (!client) {
    connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });
    client = new Client({ connection });
  }

  const workflowId = `orchestrator-${taskId}`;

  await client.workflow.start('orchestratorWorkflow', {
    args: [{ taskId, goal, repoUrl }],
    taskQueue: 'spoke-task-queue',
    workflowId,
  });

  if (ownConnection && connection) {
    await connection.close();
  }
  return workflowId;
}

async function pollPendingTasks(client: Client) {
  const { prisma } = await import('@spoke/db');
  const poll = async () => {
    try {
      const pending = await prisma.task.findMany({
        where: { status: 'pending' },
        orderBy: { created_at: 'asc' },
      });

      for (const task of pending) {
        try {
          console.log(`[poller] starting workflow for task ${task.id}: ${task.goal.slice(0, 60)}`);
          await startAgentTask(task.id, task.goal, task.repo_url, client);
          console.log(`[poller] workflow started for task ${task.id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('already started') || msg.includes('WorkflowExecutionAlreadyStarted')) {
            console.log(`[poller] workflow already running for task ${task.id}, skipping`);
          } else {
            console.error(`[poller] failed to start workflow for task ${task.id}:`, msg);
          }
        }
      }
    } catch (err) {
      console.error('[poller] db query failed:', err instanceof Error ? err.message : String(err));
    }

    setTimeout(poll, 5000);
  };

  poll();
}

async function run() {
  const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  const worker = await Worker.create({
    connection,
    workflowsPath: new URL('./workflows/index.js', import.meta.url).pathname,
    activities,
    taskQueue: 'spoke-task-queue',
  });

  console.log('orchestrator worker starting...');
  console.log('[poller] watching for pending tasks every 5s...');

  pollPendingTasks(client);

  await worker.run();
}

const isMainModule = process.argv[1] && (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]!));
if (isMainModule) {
  run().catch(console.error);
}
