# Contributing to Spoke

Thanks for your interest in contributing to Spoke.

This project is fully licensed under the MIT License. Contributions are welcome as long as they align with the goals of the project and do not introduce secrets, private infrastructure details, or proprietary code paths.

## Development setup

### 1. Clone the repository

```bash
git clone https://github.com/surajsrivastav/spoke.git
cd spoke
```

### 2. Install dependencies

Use Node 22.23.2 (`nvm use`) and pnpm 10.33.0, matching CI and Docker.

```bash
pnpm install --frozen-lockfile
pnpm --filter @spoke/db generate
```

### 3. Configure environment

Copy the example environment file before starting local services:

```bash
cp .env.example .env.local
```

Then fill in the required values for your local environment. The sample file includes Docker, database, model provider, Slack, WhatsApp, and GitHub configuration.

### 4. Start the local infrastructure

```bash
docker compose -f docker-compose.local.yml up -d --wait
```

This starts infrastructure only. Application containers use the opt-in `apps`
profile; do not start them alongside `pnpm dev` on the same ports.

### 5. Run database migrations

```bash
pnpm migrate
```

### 6. Start the app

```bash
pnpm dev
```

The dashboard is available at http://localhost:3000.

## Contribution workflow

1. Create a branch from `main`.
2. Make focused changes with clear commit messages.
3. Run the relevant tests before submitting a PR.
4. Open a pull request with a short description of the problem and the fix.

### Useful commands

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm exec tsx scripts/sandbox-smoke.ts
```

## Code standards

- Prefer small, reviewable changes.
- Do not commit secrets, private tokens, or local environment values.
- Keep examples and docs actionable for fresh repositories and first-time contributors.
- Add regression tests for behavioral changes. Tests must verify failure paths
  and real boundaries, not only mock the expected implementation.

The sandbox smoke test needs Docker and network access for its image and tools.
It uses a disposable container, no model credentials or GitHub writes.
See [release checks](docs/oss/RELEASE.md) for live provider acceptance testing.

## Pull requests

PRs should include:

- a clear description of the change
- the reason for the change
- any relevant screenshots or logs, if applicable
- verification steps run locally

## Questions

If you are unsure whether a change fits the project, open a discussion or issue before starting a large refactor.
