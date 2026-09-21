# Phase 0 Launch — TODO

Generated from codebase analysis. Ordered by priority.

---

## Status at a Glance

| Area | Done | Remaining |
|------|------|-----------|
| Core agent loop (Claude + tools + sandbox) | ✅ | — |
| Slack entry point + task creation | ✅ | — |
| Temporal workflow (7-step orchestration) | ✅ | — |
| Verification gates (lint → typecheck → test) | ✅ | — |
| Provenance / audit trail | ✅ | — |
| Operator UI + kill switch | ✅ | — |
| GitHub PR creation | ✅ | — |
| Multi-provider LLM (Claude, OpenRouter, etc.) | ✅ | — |
| Infrastructure-as-Code (Terraform + GCP) | ✅ (code) | Not deployed |
| Dockerfiles for all 4 services | ✅ | — |
| Unit tests (313 tests across 33 files) | ✅ | — |
| **Deployment to GCP** | ❌ | **BLOCKER** |
| **Dogfooding (5 PRs authored by Spoke)** | ❌ | **BLOCKER** |

---

## Critical Blockers (Must-Fix Before Any Launch)

### 1. Deploy to GCP
- [ ] **S-8.1a** — Run `terraform init && terraform plan` in `infra/terraform/`, validate all resources
- [ ] **S-8.1b** — Populate GCP Secret Manager with all required secrets:
  - `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
  - `GH_TOKEN` (GitHub PAT with `repo` scope)
  - `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`)
  - `DATABASE_URL` (Cloud SQL connection string)
  - `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`
  - `E2B_API_KEY`
- [ ] **S-8.1c** — Run `terraform apply` and verify all 4 Cloud Run services are healthy
- [ ] **S-8.1d** — Run database migration on Cloud SQL: `prisma migrate deploy`
- [ ] **S-8.1e** — Register Slack app's event subscription URL to the deployed `slack-edge` Cloud Run URL
- [ ] **S-8.1f** — Verify end-to-end health: hit `/health` on all 4 services

### 2. Fix Missing Error Handling in Kill Route
- [ ] `apps/operator-ui/src/app/api/tasks/[id]/kill/route.ts` — return HTTP 400 if task is already `completed` or `killed`; surface Temporal errors to the caller instead of swallowing silently

### 3. Fix Silent Failure in Slack Handler
- [ ] `apps/slack-edge/src/handlers/slack-event.ts` — log a structured error (and notify on-call channel) if the DB write or Temporal start fails, even though we must return `{ ok: true }` to Slack

---

## Phase 0 Dogfooding (S-8.2–8.7)

These are the acceptance criteria for Phase 0: **Spoke must author 5 PRs on the Spoke repo itself.**

- [ ] **S-8.2** — Send `@spoke` task from Slack → Temporal workflow starts → PR created on `surajsrivastav/spoke`; review and merge
- [ ] **S-8.3** — Second dogfood PR (different goal)
- [ ] **S-8.4** — Third dogfood PR
- [ ] **S-8.5** — Fourth dogfood PR
- [ ] **S-8.6** — Fifth dogfood PR
- [ ] **S-8.7** — Capture failures/friction discovered during dogfooding in a retro doc; file issues for anything that needs fixing

**Suggested dogfood tasks to submit:**
1. `@spoke add a /health/ready endpoint that checks DB and Temporal connectivity`
2. `@spoke add pagination to GET /api/tasks (page and limit query params)`
3. `@spoke write integration tests for the Slack event handler`
4. `@spoke add CORS middleware to the operator-ui API routes`
5. `@spoke add rate limiting (100 req/min) to the task creation endpoint`

---

## High Priority (Pre-Production, But Can Launch Dogfooding Without These)

### Authentication
- [ ] Add Next.js middleware that enforces a session/token on all `/api/*` routes
- [ ] Protect Operator UI pages (`/`, `/tasks/[id]`, `/sso`, `/cost`) behind login
- [ ] Store `created_by` as a real user identity instead of hardcoded `"demo"` in `apps/operator-ui/src/app/api/tasks/route.ts`

### Authorization
- [ ] Add `users` table to Prisma schema (id, email, role: viewer | operator | admin)
- [ ] Scope task queries to the authenticated user's organization
- [ ] Enforce that only the task owner or an admin can kill a task

### API Security
- [ ] Add rate limiting to `POST /api/tasks` (prevent cost exhaustion)
- [ ] Add CORS headers to operator-ui API routes (`apps/operator-ui/src/app/api/`)
- [ ] Add pagination to `GET /api/tasks` — currently returns all rows with no limit

### WhatsApp Integration
- [ ] `apps/whatsapp-edge/` receives webhooks but never creates tasks — wire it up the same way Slack does (create task row + start Temporal workflow)

### Traces Table
- [ ] `packages/db/prisma/schema.prisma` defines a `traces` table; nothing ever writes to it — either write trace records in `packages/agent/src/loop.ts` or drop the table

---

## Medium Priority (Phase 1 Prep)

### CI/CD
- [ ] Create `.github/workflows/ci.yml` — run `pnpm test`, `pnpm typecheck`, `pnpm lint` on every PR
- [ ] Create `.github/workflows/deploy.yml` — build Docker images and push to GCR on merge to `main`
- [ ] Add branch protection rules: require CI green before merge

### Cost Governance (F-07)
- [ ] Implement team budget enforcement — currently `tasks.cost_usd` is tracked but no budget cap exists at the team level
- [ ] Replace stub UI at `/cost` (currently hardcoded mock data) with real data from provenance records

### RBAC (F-08)
- [ ] Replace stub UI at `/sso` (currently hardcoded audit data) with real role management
- [ ] Implement permission checks in API handlers based on roles

### E2B Cloud Sandbox
- [ ] `packages/agent/src/sandbox.ts` is pure Docker — switch to `@e2b/code-interpreter` for cloud production runs (Docker can stay for local dev)

### Observability
- [ ] Add structured logging with request IDs across all 4 services (correlate a Slack message → task → workflow → sandbox → PR)
- [ ] Add GCP Cloud Monitoring dashboard: task throughput, agent cost per task, error rate
- [ ] Set up alerting on task failure rate > 20%

### Testing
- [ ] Add integration tests: full Slack → DB → Temporal → agent loop → PR flow against local stack
- [ ] Add E2E test using Playwright against `docker-compose.local.yml`

---

## Low Priority / Nice to Have

- [ ] Add a deployment runbook to `docs/` (step-by-step for a fresh GCP project)
- [ ] Deduplication check: `apps/slack-edge` — verify Slack `event_id` deduplication is working (per acceptance criteria S-1.5)
- [ ] Secret rotation policy for all GCP Secret Manager secrets
- [ ] Terraform remote state backend (currently local) — use GCS bucket
- [ ] Add `min-instances: 1` to `orchestrator` Cloud Run service to prevent cold-start latency on first task
- [ ] Keyboard shortcut help overlay in Operator UI (j/k navigation is undiscoverable)

---

## Definition of Done for Phase 0

Phase 0 is complete when:

1. All 4 services are deployed and healthy on GCP
2. `@spoke <goal>` in Slack creates a real GitHub PR on `surajsrivastav/spoke` with passing CI
3. The PR is reviewed and merged by a human
4. This has happened **5 times** (S-8.2–8.7)
5. Dogfooding retro is filed; all critical bugs discovered are tracked as issues
