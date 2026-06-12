---
name: integrating-temporal-workflow
description: Temporal Cloud workflow patterns for Spoke orchestration. Use when defining workflows, activities, or workers in the orchestrator app.
---

# Integrating Temporal Workflow

## Overview

Temporal Cloud provides durable execution for Spoke's agent orchestration. Workflows define the orchestration logic; activities are the individual steps.

## When to Use

- Setting up `apps/orchestrator/`
- Defining a new workflow (e.g., agent execution)
- Writing activities (e.g., sandbox provisioning)
- Configuring Temporal workers and clients
- Handling workflow retries and timeouts

## How to Apply

### 1. Installation

```bash
pnpm add @temporalio/client @temporalio/worker @temporalio/workflow
```

### 2. Defining a Workflow

```typescript
import { proxyActivities } from '@temporalio/workflow';

const { createSandbox, runAgent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

export async function agentExecutionWorkflow(taskId: string, action: string) {
  const sandboxId = await createSandbox(taskId);
  const result = await runAgent(sandboxId, action);
  return result;
}
```

### 3. Defining Activities

```typescript
import { ActivityInboundLogInterceptor } from '@temporalio/worker';

export async function createSandbox(taskId: string): Promise<string> {
  const sandbox = await Sandbox.create({ timeoutMs: 300_000 });
  return sandbox.id;
}

export async function runAgent(sandboxId: string, action: string) {
  // Agent execution logic
  return { status: 'done', output: '...' };
}
```

### 4. Worker Setup

```typescript
import { Worker } from '@temporalio/worker';

const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  activities: { createSandbox, runAgent },
  taskQueue: 'spoke-agent-queue',
});

await worker.run();
```

### 5. Starting a Workflow

```typescript
import { Client } from '@temporalio/client';

const client = new Client();
const handle = await client.workflow.start(agentExecutionWorkflow, {
  args: ['task-123', 'deploy staging'],
  taskQueue: 'spoke-agent-queue',
  workflowId: `agent-${taskId}`,
});

const result = await handle.result();
```

## Configuration

| Env Var | Description |
|---|---|
| `TEMPORAL_ADDRESS` | Temporal Cloud address |
| `TEMPORAL_NAMESPACE` | Temporal Cloud namespace |
| `TEMPORAL_API_KEY` | Temporal Cloud API key |

## Anti-patterns

- ❌ Don't put non-deterministic logic in workflows (use activities)
- ❌ Don't mutate workflow state outside of workflow functions
- ❌ Don't ignore timeout configurations (set for all activities)
- ❌ Don't use long timeouts without heartbeat for activities

## Related Skills

- `integrating-e2b-sandbox` — Sandbox activities
- `integrating-claude-agent-sdk` — Agent execution
- `writing-unit-test-typescript` — Testing workflows
