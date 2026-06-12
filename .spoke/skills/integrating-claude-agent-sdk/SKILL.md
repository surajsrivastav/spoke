---
name: integrating-claude-agent-sdk
description: Integrate Claude Agent SDK for agent loop execution in Spoke. Use when implementing the agent execution loop, tool calling, or agent lifecycle in the orchestrator.
---

# Integrating Claude Agent SDK

## Overview

The Claude Agent SDK powers the agent execution loop in Spoke's orchestrator. It manages conversation state, tool calling, and response generation.

## When to Use

- Setting up `packages/agent/`
- Implementing the agent execution loop
- Defining tools the agent can call
- Handling agent responses and errors
- Configuring model routing (via OpenRouter)

## How to Apply

### 1. Installation

```bash
pnpm add @anthropic-ai/sdk
```

### 2. Basic Agent Loop

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runAgent(task: string, tools: Tool[]) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: 'You are a helpful assistant for Spoke.',
    messages: [{ role: 'user', content: task }],
    tools,
  });

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const result = await executeTool(block.name, block.input);
      // Continue conversation with tool result...
    }
  }
}
```

### 3. Tool Definition

```typescript
const tools = [
  {
    name: 'execute_code',
    description: 'Run TypeScript code in an E2B sandbox',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
      },
      required: ['code'],
    },
  },
];
```

### 4. Model Routing via OpenRouter

```typescript
const client = new Anthropic({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

## Configuration

| Env Var | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Direct Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (alternative routing) |
| `DEFAULT_MODEL` | Model ID for agent execution |

## Anti-patterns

- ❌ Don't expose raw API keys in agent output
- ❌ Don't allow unbounded tool execution (set timeouts)
- ❌ Don't skip error handling for API failures
- ❌ Don't let agent run without sandbox isolation

## Related Skills

- `integrating-e2b-sandbox` — Code execution in sandboxes
- `integrating-temporal-workflow` — Orchestrating agent runs
- `integrating-openrouter` — Model gateway routing
