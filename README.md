# Spoke

**Open source control plane for autonomous coding agent fleets.**  
Multi-model, self-hosted, bring your own agent. Kill switches and provenance included.

This repository is fully open source under the MIT license. There are no separate paid or proprietary terms for the code in this repo.

---

## Overview

Spoke is an operator-first platform for running autonomous coding agents at scale. Submit tasks via Slack, WhatsApp, or API — Spoke provisions sandboxes, runs agents, verifies output, and creates PRs — all with a kill switch and full provenance chain.

See the full architecture documentation in [docs/architecture/README.md](docs/architecture/README.md), which includes the contextual diagram, workflow sequence diagram, and tooling breakdown.

### Demo

[![Spoke dashboard](.github/assets/demo.png)](https://github.com/surajsrivastav/spoke/blob/main/.github/assets/demo.mp4)

*Click the screenshot above to watch the demo video.*

### Key Features

- **Multi-entry** — Submit tasks from Slack, WhatsApp, CLI, or API
- **Bring your own agent** — Works with Claude, GPT, Gemini, local Ollama models, or any OpenAI-compatible provider
- **Self-hosted** — Runs on your infra via Docker Compose or GCP Cloud Run
- **Sandboxed execution** — Each task runs in an isolated Docker container
- **Kill switch** — Kill any running task from the dashboard or API
- **Provenance** — Full audit trail of every agent action, model call, and tool invocation
- **Verification gates** — Automated verification before PR creation
- **PR automation** — Creates PRs with agent-generated changes

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/installation) ≥ 9

### 1. Clone and install

```bash
git clone https://github.com/surajsrivastav/spoke.git
cd spoke
pnpm install
```

### 2. Configure local environment

```bash
cp .env.example .env.local
```

Update `.env.local` to match your local setup, especially the database, model provider, and service tokens.

### 3. Start infrastructure

```bash
docker compose -f docker-compose.local.yml up -d
```

This starts:
- **PostgreSQL** (port 5432) — primary datastore
- **Temporal** (port 7233) — workflow orchestration engine
- **Temporal Web UI** (port 8233) — workflow inspector
- **Slack Edge** (port 3001) — Slack webhook receiver
- **WhatsApp Edge** (port 3002) — WhatsApp webhook receiver

### 4. Run database migrations

```bash
pnpm --filter @spoke/db exec prisma migrate deploy
```

### 5. Start development servers

```bash
pnpm dev
```

This starts:
- **Operator UI** (port 3000) — web dashboard
- **Orchestrator** (port 8080) — Temporal worker
- **Slack Edge** (port 3001) — Slack integration
- **WhatsApp Edge** (port 3002) — WhatsApp integration

### 6. Open the dashboard

Visit [http://localhost:3000](http://localhost:3000)

### Resetting a local environment

```bash
docker compose -f docker-compose.local.yml down -v
rm -f .env.local
cp .env.example .env.local
pnpm install
pnpm --filter @spoke/db exec prisma migrate deploy
pnpm dev
```

---

## Configuration

Copy `.env.example` to `.env.local` and configure:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://spoke:spoke_dev@localhost:5432/spoke_dev` | PostgreSQL connection |
| `DEFAULT_MODEL` | `llama3.2:3b` | Model for agent execution |
| `MODEL_PROVIDER` | `ollama` | Provider: `ollama`, `openrouter`, `anthropic`, `copilot` |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama API endpoint |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `GH_TOKEN` | — | GitHub token for PR creation |

---

## Architecture

```
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│   Slack     │  │   WhatsApp   │  │  Operator UI │
│   (3001)    │  │   (3002)     │  │   (3000)     │
└──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        ▼
               ┌────────────────┐
               │  Orchestrator  │
               │   (Temporal)   │
               └────┬──────┬────┘
                    │      │
            ┌───────▼┐  ┌──▼────────┐
            │ Sandbox │  │  Model   │
            │ (Docker)│  │ Provider │
            └─────────┘  └───────────┘
```

### Services

| Service | Role | Tech |
|---|---|---|
| **Operator UI** | Web dashboard for task management | Next.js 14 |
| **Orchestrator** | Temporal worker — runs agent workflows | TypeScript, Temporal |
| **Slack Edge** | Slack event handler | Hono.js |
| **WhatsApp Edge** | WhatsApp webhook handler | Hono.js |
| **Agent** | SDK — agent loop, tools, sandbox, verification | TypeScript |
| **Provenance** | Audit trail writer | TypeScript, Prisma |
| **Database** | PostgreSQL with Prisma ORM | PostgreSQL |

---

## Usage

### Submit a task via Slack

```
@spoke Build a todo list app with React
```

### Submit a task via API

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"goal": "Add dark mode toggle", "repo_url": "https://github.com/org/repo"}'
```

### Kill a task

```bash
curl -X POST http://localhost:3000/api/tasks/<task-id>/kill
```

Or click the kill button in the dashboard.

---

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @spoke/orchestrator test
pnpm --filter @spoke/operator-ui test
```

Current coverage: **332 tests, 0 failures** across 7 packages.

---

## Project Structure

```
apps/
├── slack-edge/         # Slack bot entry point
├── whatsapp-edge/       # WhatsApp bot entry point
├── orchestrator/        # Temporal worker — agent orchestration
└── operator-ui/         # Next.js dashboard

packages/
├── agent/               # Agent SDK — loop, tools, sandbox, LLM providers
├── db/                  # Prisma schema + migrations
├── provenance/          # Typed provenance chain
└── shared/              # Shared types, env, utilities

infra/
└── terraform/           # GCP Cloud Run deployment
```

---

## License

This project is licensed under the [MIT License](LICENSE).
