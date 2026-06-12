---
name: writing-unit-test-typescript
description: Write Vitest unit tests for TypeScript code in Spoke. Use when testing functions, modules, API handlers, or Temporal workflows.
---

# Writing Unit Tests (TypeScript + Vitest)

## Overview

Unit testing patterns for the Spoke monorepo using Vitest. Covers test structure, mocking, Temporal workflow testing, and coverage.

## When to Use

- Testing a function or module
- Testing a Hono API handler
- Testing a Temporal workflow or activity
- Adding regression tests for bug fixes
- Running tests via `pnpm -r test`

## Test File Location

Tests live next to source files in `__tests__/`:

```
packages/<name>/
└── src/
    ├── tasks.ts
    └── __tests__/
        └── tasks.test.ts
```

## Test Patterns

### Basic Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { createTask } from '../tasks';

describe('createTask', () => {
  it('creates a task with the given action', () => {
    const task = createTask('deploy staging');
    expect(task.action).toBe('deploy staging');
    expect(task.status).toBe('pending');
  });

  it('throws for empty action', () => {
    expect(() => createTask('')).toThrow('action is required');
  });
});
```

### Mocking Dependencies

```typescript
import { vi, describe, it, expect } from 'vitest';
import { createTaskService } from '../tasks';

const mockDb = {
  task: { create: vi.fn() },
};

describe('createTaskService', () => {
  it('creates a task in the database', async () => {
    mockDb.task.create.mockResolvedValue({ id: '1', action: 'deploy' });
    const service = createTaskService(mockDb as any);

    const result = await service.createTask('deploy');
    expect(mockDb.task.create).toHaveBeenCalledWith({
      data: { action: 'deploy' },
    });
    expect(result.id).toBe('1');
  });
});
```

### Hono API Handler Testing

```typescript
import { describe, it, expect } from 'vitest';
import app from '../routes';

describe('POST /tasks', () => {
  it('returns 201 for valid request', async () => {
    const res = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action).toBe('deploy');
  });

  it('returns 422 for invalid request', async () => {
    const res = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });
});
```

### Temporal Workflow Testing

```typescript
import { describe, it, expect } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { agentExecutionWorkflow } from '../workflows';

describe('agentExecutionWorkflow', () => {
  it('completes with result', async () => {
    const env = await TestWorkflowEnvironment.create();
    const { client, nativeWorker } = env;

    // Register mock activities
    nativeWorker.registerActivities({
      createSandbox: async () => 'sandbox-1',
      runAgent: async () => ({ status: 'done' }),
    });

    const handle = await client.workflow.start(agentExecutionWorkflow, {
      args: ['task-1', 'deploy'],
      taskQueue: 'test',
      workflowId: 'test-1',
    });

    const result = await handle.result();
    expect(result.status).toBe('done');
    await env.teardown();
  });
});
```

## Running Tests

```bash
# All packages
pnpm -r test

# Single package
pnpm --filter @spoke/tasks test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

## Anti-patterns

- ❌ Don't test only the happy path
- ❌ Don't write tests that depend on external services (use mocks)
- ❌ Don't skip integration tests for "small" features
- ❌ Don't use `vi.useFakeTimers()` without cleanup

## Related Skills

- `writing-typescript-module` — Module patterns being tested
- `code-review-typescript` — Reviewing test quality
- `integrating-temporal-workflow` — Testing workflows
