---
name: writing-typescript-module
description: Standard TypeScript module patterns for the Spoke monorepo. Use when creating a new package, module, or file in the pnpm workspace.
---

# Writing TypeScript Modules

## Overview

Standard patterns for TypeScript modules in the Spoke pnpm monorepo. Covers exports, types, validation, and package structure.

## When to Use

- Creating a new package under `packages/`
- Adding a new module to an existing package
- Defining shared types or utilities
- Setting up a Hono API route handler

## Package Structure

```
packages/<name>/
├── src/
│   ├── index.ts          # Public API exports
│   ├── types.ts          # Type exports
│   └── __tests__/        # Vitest tests
├── package.json
└── tsconfig.json
```

## Module Patterns

### Barrel Exports

```typescript
// src/index.ts
export * from './types';
export { createTask, getTask } from './tasks';
export type { Task, TaskStatus } from './tasks';
```

### Zod Schema + Type

```typescript
import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1).max(500),
  status: z.enum(['pending', 'running', 'done', 'failed']),
});

export type Task = z.infer<typeof TaskSchema>;
```

### Hono Route Handler

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const CreateTaskSchema = z.object({
  action: z.string().min(1),
});

app.post('/tasks', zValidator('json', CreateTaskSchema), async (c) => {
  const data = c.req.valid('json');
  const task = await createTask(data);
  return c.json(task, 201);
});
```

### Dependency Injection Pattern

```typescript
import { PrismaClient } from '@prisma/client';

export function createTaskService(db: PrismaClient) {
  return {
    async createTask(action: string) {
      return db.task.create({ data: { action } });
    },
  };
}
```

## Conventions

- Public API lives in `src/index.ts` — consumers import from the package name
- Internal modules are prefixed with `_` (e.g., `src/_internal.ts`)
- Every exported function has a unit test
- Use Zod for runtime validation at API boundaries
- Prefer `const` over `function` for type safety

## Anti-patterns

- ❌ Don't export internal implementation details from `index.ts`
- ❌ Don't skip input validation on API endpoints
- ❌ Don't import from sibling directories (use the package name)

## Related Skills

- `writing-unit-test-typescript` — Testing modules
- `writing-architecture-decision-record` — Package design decisions
