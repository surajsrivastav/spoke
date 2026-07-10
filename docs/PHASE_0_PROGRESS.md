# Phase 0 Progress

## Week 1: Foundation
**Goal**: Working monorepo, Postgres running locally, schema deployed.

- [x] **S-1.1**: Bootstrap monorepo
  - Created: `apps/slack-edge`, `apps/orchestrator`, `apps/operator-ui`, `packages/agent`, `packages/provenance`
  - Status: **Complete** — 9 workspace packages, pnpm install passes
- [x] **S-1.2**: Provision GCP + Terraform
  - Created: `infra/terraform/` with 8 files (main, variables, outputs, cloud-sql, secret-manager, cloud-run, workload-identity, iam)
  - Status: **Complete** — Config ready for `terraform apply`
- [x] **S-1.3**: Prisma schema + migration
  - 5 tables: `tasks`, `task_runs`, `provenance`, `traces`, `pull_requests`
  - Created: initial migration `20250530000000_init`, Prisma client export
  - Status: **Complete** — Schema ready, migration SQL generated

## Week 2: Slack Edge + Task Creation
**Goal**: Slack `@spoke` creates a task row.

- [x] S-2.1: Slack app setup
  - Created: `slack-manifest.yml` with bot scopes and event subscription for `app_mention`
  - Status: **Complete** — Manifest ready to deploy
- [x] S-2.2: Slack signature verification
  - Created: `apps/slack-edge/src/verify-slack-request.ts` — Hono middleware using `@slack/events-api` signing algorithm
  - Status: **Complete** — Invalid requests return 401
- [x] S-2.3: Mention handler + task creation
  - Created: `apps/slack-edge/src/index.ts` — Hono server with `app_mention` handler that creates Task in DB via Prisma, replies via Slack Web API
  - Status: **Complete** — `@spoke` triggers task creation

## Week 3: Temporal Workflow + Worker
**Goal**: Task goes from "pending" to "running" — worker picks it up.

- [x] S-3.1: Temporal Cloud namespace (local dev server)
  - Status: **Local** — uses `temporal server start-dev` on `localhost:7233`
- [x] S-3.2: Define agentTaskWorkflow
  - Created: `apps/orchestrator/src/workflows/agent-task.ts` — 7-step ordered workflow with error handling + cleanup
  - Status: **Complete**
- [x] S-3.3: Stub all activities
  - Created: `apps/orchestrator/src/activities/index.ts` — 7 activities (later replaced with real implementations in S-5.3, S-7.1-7.2)
  - Status: **Complete**
- [x] S-3.4: Slack → Temporal trigger
  - Created: `apps/orchestrator/src/index.ts` — Temporal worker connecting to `localhost:7233`, registers workflow + activities
  - Status: **Complete**

## Week 4: Agent Loop + E2B Sandbox
**Goal**: Real Claude API call generates code in real E2B sandbox.

- [x] S-4.1: Provision E2B sandbox
  - Created: `packages/agent/src/sandbox.ts` — `provisionSandbox()` and `destroySandbox()` using `@e2b/code-interpreter`
  - Status: **Complete** — 15-min idle timeout, cleanup in finally block
- [x] S-4.2: Claude Agent SDK integration
  - Created: `packages/agent/src/loop.ts` — `runAgentLoop()` using `@anthropic-ai/sdk`, sends goal + previous errors, processes tool_use blocks, $5 cost cap, token tracking
  - Status: **Complete**
- [x] S-4.3: Tool execution in sandbox
  - Created: `packages/agent/src/tools.ts` — `executeShell`, `executeReadFile`, `executeWriteFile`, `executeGit`
  - Status: **Complete** — Each returns `{ stdout, stderr, exitCode }`, piped back to Claude

## Week 5: Verification + Provenance
**Goal**: Failed tests trigger retry; everything logged.

- [x] S-5.1: Verification gates
  - Created: `packages/agent/src/verify.ts` — `runVerification()` runs lint → typecheck → test in sandbox
  - Status: **Complete** — Non-short-circuiting, returns `{ passed, errors }`
- [x] S-5.2: Provenance writes
  - Created: `packages/provenance/src/index.ts` — append-only Provenance records with `writeProvenance()`
  - Status: **Complete**
- [x] S-5.3: Agent retry logic
  - Updated: `apps/orchestrator/src/workflows/agent-task.ts` — retry loop with max 2 additional attempts, passing `prevErrors`
  - Updated: `apps/orchestrator/src/activities/index.ts` — replaced stubs with real implementations
  - Status: **Complete**

## Week 6: Operator UI
**Goal**: Open localhost:3000, see live task running.

- [x] S-6.1: Next.js setup
  - Created: `apps/operator-ui/` — Next.js 14 with App Router, Tailwind, API routes
  - Status: **Complete**
- [x] S-6.2: Fleet grid with SSE
  - Created: `apps/operator-ui/src/app/page.tsx` — task grid with color-coded status, SSE at `/api/events`
  - Status: **Complete**
- [x] S-6.3: Trace viewer
  - Created: `apps/operator-ui/src/app/tasks/[id]/page.tsx` — task detail with runs, expandable provenance tree
  - Status: **Complete**

## Week 7: GitHub + Kill Switch
**Goal**: Real PRs created. Operator can kill tasks.

- [x] S-7.1: Push branch
  - Created: `packages/agent/src/github.ts` — `pushBranch(sandboxId, repoUrl, goal)` configures git, creates branch `spoke/<taskId>-<slug>`, commits, pushes using GH_TOKEN
  - Status: **Complete**
- [x] S-7.2: Create PR
  - Created: `packages/agent/src/github.ts` — `createPr(repoUrl, branch, goal, description?)` creates PR via GitHub API
  - Updated: `apps/orchestrator/src/activities/index.ts` — replaced stubs with real calls, creates PullRequest DB record
  - Status: **Complete**
- [x] S-7.3: Kill switch
  - Updated: `apps/orchestrator/src/workflows/agent-task.ts` — added `defineSignal('kill')` + `setHandler`, cancelled flag checked at each step
  - Updated: `apps/orchestrator/src/activities/index.ts` — added `killTask(taskId)` activity
  - Created: `apps/operator-ui/src/app/api/tasks/[id]/kill/route.ts` — POST handler sets status to `killed`
  - Updated: `apps/operator-ui/src/app/tasks/[id]/page.tsx` — orange Kill button for running tasks
  - Status: **Complete**

## Week 8: Polish + Dogfooding
**Goal**: **5 PRs on Spoke authored by Spoke.**

- [x] S-8.1: Deploy to GCP
  - Created: Dockerfiles for all 4 apps (`slack-edge`, `whatsapp-edge`, `orchestrator`, `operator-ui`)
  - Created: `.dockerignore` at repo root
  - Updated: `infra/terraform/` — image tag variable, env vars from Secret Manager, startup-cpu-boost, min-instances: 0
  - Updated: `docker-compose.local.yml` — slack-edge + whatsapp-edge services
  - Status: **Complete** — Ready for `terraform apply`
- [ ] S-8.2-8.7: Dogfooding (5 PRs)
  - Status: **Pending** — Manual process: deploy Spoke, send tasks from Slack, review & merge PRs

## Verification Folder
- [x] Created: `docs/verification/VERIFICATION.md` — step-by-step verification instructions for all 8 weeks

## Enterprise Features (post-Phase-0)
**Goal**: F-06 SSO, F-07 Cost Governance, F-08 RBAC per `docs/oss/SPOKE_ACCEPTANCE_CRITERIA.md`.

- [x] **F-06 SSO Login** (gated by `AUTH_ENABLED=true`, OSS default off)
  - Created: `apps/operator-ui/src/lib/auth.ts` (OIDC config, sessions, audit), routes `api/auth/sso/login`, `api/auth/sso/callback`, `api/auth/me`, `api/auth/logout`
  - Domain→org matching via `SSO_ALLOWED_DOMAINS`, JIT provisioning with default role, provider-outage handling, 8h session expiry → `401 session_expired`
- [x] **F-07 Cost Governance**
  - Created: `packages/agent/src/errors.ts` (`CostCapExceededError` thrown at cap), per-task cap passed from task record through `runAgent`
  - Created: `packages/db/src/budget.ts` — team monthly budgets checked before task creation (API 402 + Slack rejection reply)
  - Created: `apps/operator-ui/src/app/api/costs/route.ts` — real aggregates; cost page wired to live data; traces written per agent run
- [x] **F-08 RBAC**
  - Created: `apps/operator-ui/src/lib/rbac.ts` — admin/operator/viewer matrix; kill route returns 403 `insufficient_permissions` for viewers, 404 for cross-team access; audit log rows for allowed + denied actions; role change invalidates sessions
- [x] Migration `20260709000000_enterprise_features` — `teams`, `users`, `sessions`, `audit_logs` tables; `tasks.total_cost_usd`, `failure_reason`, `team_id`

## End-to-End Verification (2026-07-09/10, local stack)
All services live (Postgres + Temporal via Docker, 4 dev servers). Scenarios verified against the real stack:

- [x] Happy path: API task → Temporal workflow → Docker sandbox → agent (gpt-4o-mini via GitHub Models) → verification → branch push → **real PR opened** (`test-auto-create#2`), status `succeeded`, full provenance chain, cost recorded ($0.03)
- [x] Kill switch: running task killed via API in <1s (AC ≤10s), workflow signal honored, sandbox destroyed
- [x] Cost cap: $0-cap task fails with `failure_reason=cost_cap_exceeded` + provenance event
- [x] Team budget: $3-budget team rejects $5-cap task with HTTP 402; within-budget task accepted
- [x] Slack entry: HMAC signature verified (401 on invalid), signed mention creates task and starts workflow
- [x] WhatsApp: webhook handshake 200/403 on good/bad verify token
- [x] SSE: `/api/events` streams live task + cost updates
- [x] SSO/RBAC live matrix: no session 401, valid session 200, expired session 401, login 302 to IdP, viewer kill 403, operator own-team kill 200, cross-team kill 404, mid-session demotion 401, audit trail rows for all outcomes

### Bugs found and fixed during E2E
1. Kill-route tests hung 5s each — Temporal client unmocked; added mocks + 2s `connectTimeout` in the route
2. `packages/db` `./budget.js` import broke Next.js webpack — switched to extensionless imports
3. Slack tasks with unset `TARGET_REPO_URL` ran agents then failed at `createPr` — now rejected up front with a config warning reply
4. Trace page crashed on run status `provisioning` (`StatusBadge` missing config) — added neutral fallback
5. Fleet page showed `Math.random()` costs/times/sources and faked "Cost today" — now computed from real task data
6. Task runs never closed — terminal task statuses now set `task_runs.status`/`ended_at` and `tasks.completed_at`
7. Cost analytics empty — agent runs now write `traces` rows (model, tokens, cost)
