---
name: integrating-e2b-sandbox
description: Provision and manage E2B sandboxes for secure agent code execution. Use when implementing sandbox creation, code execution, file operations, or sandbox lifecycle management.
---

# Integrating E2B Sandbox

## Overview

E2B provides isolated cloud sandboxes for running agent-generated code. Each sandbox is a lightweight VM that can execute TypeScript/Python, install dependencies, and be terminated when done.

## When to Use

- Setting up `packages/sandbox/`
- Provisioning a sandbox for an agent task
- Executing code inside a sandbox
- Managing sandbox lifecycle (create, keep-alive, terminate)
- Handling sandbox timeouts and errors

## How to Apply

### 1. Installation

```bash
pnpm add e2b
```

### 2. Creating a Sandbox

```typescript
import { Sandbox } from 'e2b';

const sandbox = await Sandbox.create({
  timeoutMs: 300_000, // 5 min
  metadata: { taskId: 'task-123' },
});
```

### 3. Executing Code

```typescript
const result = await sandbox.runCode(`
  const data = { message: "hello from sandbox" };
  console.log(JSON.stringify(data));
`, { language: 'typescript' });

console.log(result.stdout); // '{"message":"hello from sandbox"}'
```

### 4. File Operations

```typescript
// Write files
await sandbox.files.write('/home/user/data.json', JSON.stringify({ key: 'value' }));

// Read files
const content = await sandbox.files.read('/home/user/data.json');

// List directory
const entries = await sandbox.files.list('/home/user');
```

### 5. Installing Dependencies

```typescript
await sandbox.runCode('npm install express zod', { language: 'shell' });
```

### 6. Lifecycle Management

```typescript
// Keep alive (refresh timeout)
await sandbox.keepAlive({ timeoutMs: 300_000 });

// Terminate when done
await sandbox.kill();
```

## Configuration

| Env Var | Description |
|---|---|
| `E2B_API_KEY` | API key from E2B dashboard |

## Anti-patterns

- ❌ Don't leave sandboxes running indefinitely — always kill after use
- ❌ Don't execute untrusted code without sandbox isolation
- ❌ Don't hardcode API keys in source
- ❌ Don't ignore sandbox timeout errors

## Related Skills

- `integrating-claude-agent-sdk` — Agent loop that uses sandboxes
- `writing-typescript-module` — Module structure
- `writing-unit-test-typescript` — Testing sandbox code
