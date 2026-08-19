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

```bash
pnpm install
```

### 3. Configure environment

Copy the example environment file before starting local services:

```bash
cp .env.example .env.local
```

Then fill in the required values for your local environment. The sample file includes Docker, database, model provider, Slack, WhatsApp, and GitHub configuration.

### 4. Start the local infrastructure

```bash
docker compose -f docker-compose.local.yml up -d
```

This starts PostgreSQL, Temporal, and the local supporting services.

### 5. Run database migrations

```bash
pnpm --filter @spoke/db exec prisma migrate deploy
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
```

## Code standards

- Prefer small, reviewable changes.
- Do not commit secrets, private tokens, or local environment values.
- Keep examples and docs actionable for fresh repositories and first-time contributors.
- Add or update tests for behavioral changes when practical.

## Pull requests

PRs should include:

- a clear description of the change
- the reason for the change
- any relevant screenshots or logs, if applicable
- verification steps run locally

## Questions

If you are unsure whether a change fits the project, open a discussion or issue before starting a large refactor.
