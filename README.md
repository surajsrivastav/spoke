# Harness

Operator-first control plane for agent fleets.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local services
docker-compose up -d

# Run migrations
pnpm migrate

# Start services
pnpm dev
```

## Structure

```
apps/
├── slack-edge/      # Slack bot entry point (Cloud Run)
├── orchestrator/    # Agent worker (Cloud Run)
└── operator-ui/     # Next.js dashboard

packages/
├── db/              # Prisma schema + migrations
├── provenance/      # Typed provenance writer
├── agent/           # Claude Agent SDK wrapper
└── shared/          # Shared types

infra/
└── terraform/       # GCP IaC
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.
