# OSS beta release checklist

The README and SECURITY.md describe current supported behavior. Older PRDs,
phase reports, and architecture plans may contain unimplemented features.

## Automated checks

- Use the pinned Node and pnpm versions, install with `--frozen-lockfile`, generate
  Prisma, and run lint, typecheck, tests, and production builds.
- Run `pnpm exec tsx scripts/sandbox-smoke.ts` with Docker. It must prove a passing
  fixture succeeds and a deliberately failing test blocks verification.
- Build application images with `docker compose -f docker-compose.local.yml --profile apps build`.
- On a fresh database, apply all Prisma migrations. Confirm `/api/tasks` returns
  an empty array and the worker connects to Temporal without restart loops.

## Live acceptance test (before promoting a release)

Use a disposable GitHub repository you own with a `main` branch and package
scripts for lint, typecheck, and tests. Configure a supported model and a token
restricted to that repository. This test incurs model costs and creates a branch/PR.

1. Submit a small README change through the dashboard or documented HTTP API.
2. Record the task ID and observe pending → running → succeeded.
3. Confirm the trace contains agent and verification activity, the PR diff matches
   the request, and the sandbox container is removed after completion.
4. Repeat with an intentionally failing test. Confirm verification fails, the
   retry limit is respected, and no PR is created unless the failure is fixed.
5. Request cancellation. Confirm the workflow stops at its next cancellation
   checkpoint and cleans up. Do not claim immediate preemption.
6. Save the model/provider, commit SHA, OS, results, and remaining limitations in
   the release notes. Never publish tokens, private source, or raw private traces.

## Repository settings and publishing

- Require the `quality` and `containers` CI jobs through a main-branch ruleset.
  Workflow files alone do not enforce branch protection.
- Enable GitHub private vulnerability reporting and secret scanning where available.
- Review tracked files and git history for credentials before changing visibility.
- Review dependency alerts and provenance/licensing of contributed code.
- Tag an explicitly experimental beta only after the acceptance checks pass.
- Publish release notes with the scope and security limitations; do not describe
  the current beta as production-ready or multi-tenant.

Changing repository visibility, branch protection, and publishing a release are
separate maintainer actions; this checklist does not perform them.
