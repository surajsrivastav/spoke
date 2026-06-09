# Phase 0 — Verification Steps

Instructions for manually verifying each week's deliverables.

---

## Week 1: Foundation

### S-1.1: Bootstrap monorepo

```bash
# 1. Verify all packages exist
ls -d apps/*/
ls -d packages/*/

# 2. Verify pnpm install works
pnpm install

# 3. Verify typecheck passes
pnpm typecheck

# 4. Verify lint passes
pnpm lint
```

**Expected:** 4 apps (whatsapp-edge, slack-edge, orchestrator, operator-ui), 4 packages (db, agent, provenance, shared), all typechecks/lints pass.

### S-1.2: GCP Terraform

```bash
# 1. Verify terraform configs exist
ls infra/terraform/*.tf

# 2. Validate terraform (requires terraform CLI)
cd infra/terraform
terraform init -backend=false
terraform validate
```

**Expected:** 8 terraform files, validation passes. Creates Cloud SQL (PG16), Secret Manager (6 secrets), Cloud Run (3 services), Workload Identity.

### S-1.3: Prisma schema + migration

```bash
# 1. Start Postgres
docker run -d --name spoke-pg -e POSTGRES_USER=spoke -e POSTGRES_PASSWORD=spoke_dev -e POSTGRES_DB=spoke_dev -p 5432:5432 postgres:16-alpine

# 2. Generate Prisma client
pnpm --filter @spoke/db generate

# 3. Run migration
DATABASE_URL=postgresql://spoke:spoke_dev@localhost:5432/spoke_dev pnpm migrate

# 4. Verify tables
docker exec spoke-pg psql -U spoke -d spoke_dev -c "\dt"
```

**Expected:** 5 tables: `tasks`, `task_runs`, `provenance`, `traces`, `pull_requests`. All FKs and indexes created.

---

## Week 2: Slack Edge + Task Creation

### S-2.1: Slack app setup

```bash
# 1. Verify slack-manifest.yml exists
cat slack-manifest.yml

# 2. Verify slack-edge package has correct deps
cat apps/slack-edge/package.json
```

**Expected:** Manifest has bot scopes `app_mentions:read`, `chat:write`, event subscription for `app_mention`. Package depends on `@spoke/db`, `@spoke/shared`, `@slack/web-api`.

### S-2.2: Slack signature verification

```bash
# 1. Start slack-edge server
cd apps/slack-edge && npx tsx src/index.ts

# 2. Test invalid signature → 401
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test"}'
# Expected: 401

# 3. Test health endpoint (no auth required)
curl -s http://localhost:3001/health
# Expected: {"status":"ok"}
```

**Expected:** Requests without valid Slack signature return 401. Health endpoint passes without auth.

### S-2.3: Mention handler + task creation

```bash
# Requires running Postgres + properly configured Slack env vars
# Test by sending a valid Slack event with app_mention type
curl -s -X POST http://localhost:3001/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"event_callback","event":{"type":"app_mention","user":"U123","ts":"1234.5678","channel":"C123","text":"<@U456> fix the logging"}}'
# Expected: {"ok":true} (requires valid Slack signature header to pass verification)
```

**Note:** Full end-to-end test requires Slack app configured with real signing secret and bot token.

---

## Week 3: Temporal Workflow + Worker

### S-3.1: Temporal Cloud namespace (admin task)

**Manual step:** Create Temporal Cloud namespace `spoke-dev` or run Temporal dev server locally:
```bash
# Using Temporal CLI
temporal server start-dev
```

### S-3.2: Define agentTaskWorkflow

```bash
# Verify workflow file exists
cat apps/orchestrator/src/workflows/agent-task.ts
```

**Expected:** Workflow defined with 7 activities in order: updateTaskStatus → provisionSandbox → runAgent → verify → pushBranch → createPr → updateTaskStatus. Error handling + finally block for cleanup.

### S-3.3: Stub all activities

```bash
# Verify activities exist
cat apps/orchestrator/src/activities/index.ts
```

**Expected:** 7 activities defined, each with proper imports from `@spoke/agent`, `@spoke/db`, `@spoke/provenance`, `@spoke/shared`.

### S-3.4: Slack → Temporal trigger

```bash
# Verify worker bootstrap
cat apps/orchestrator/src/index.ts

# Typecheck
pnpm typecheck
```

**Expected:** Worker connects to `localhost:7233`, registers workflows and activities on `spoke-task-queue`.

---

## Week 4: Agent Loop + E2B Sandbox

### S-4.1: Provision E2B sandbox

```bash
# Verify sandbox functions
cat packages/agent/src/sandbox.ts
```

**Expected:** `provisionSandbox()`, `destroySandbox(sandboxId)` functions using E2B SDK. Requires `E2B_API_KEY` env var.

### S-4.2: Claude Agent SDK integration

```bash
# Verify agent loop
cat packages/agent/src/loop.ts
```

**Expected:** `runAgentLoop(sandboxId, goal, taskRunId, prevErrors?)` function that:
- Initializes Claude API client
- Sends goal + optional previous errors
- Processes tool_use blocks (shell, read_file, write_file, git)
- Enforces $5 cost cap
- Tracks token usage

### S-4.3: Tool execution in sandbox

```bash
# Verify tool functions
cat packages/agent/src/tools.ts
```

**Expected:** `executeShell`, `executeReadFile`, `executeWriteFile`, `executeGit` functions returning `{ stdout, stderr, exitCode }`.

---

## Week 5: Verification + Provenance

### S-5.1: Verification gates

```bash
# Verify verification function
cat packages/agent/src/verify.ts
```

**Expected:** `runVerification(sandboxId)` runs lint → typecheck → test in sandbox. Returns `{ passed, errors }`. Non-short-circuiting.

### S-5.2: Provenance writes

```bash
# Verify provenance function
cat packages/provenance/src/index.ts
```

**Expected:** `writeProvenance({ taskRunId, type, payload, costUsd, tokens, durationMs })` creates append-only Provenance record.

### S-5.3: Agent retry logic

```bash
# Verify retry loop in workflow
cat apps/orchestrator/src/workflows/agent-task.ts | grep -A 10 "retry\|RETRY\|max.*attempt"
```

**Expected:** Retry loop with max 2 additional attempts, passing `prevErrors` to agent each time.

---

## Week 6: Operator UI

### S-6.1: Next.js setup

```bash
# Verify Next.js is configured
ls apps/operator-ui/src/app/
cat apps/operator-ui/package.json
```

**Expected:** App Router structure (`layout.tsx`, `page.tsx`), Next.js config, Tailwind config, scripts for dev/build/start.

### S-6.2: Fleet grid with SSE

```bash
# Start the UI (requires Postgres)
cd apps/operator-ui && npx next dev -p 3000

# Verify health
curl -s http://localhost:3000/api/tasks
# Expected: [] (empty array, or list of tasks)
```

**Expected:** `/` shows task grid with color-coded status cards. SSE at `/api/events` pushes live updates.

### S-6.3: Trace viewer

```bash
# Open in browser
open http://localhost:3000/tasks/<task-id>
```

**Expected:** Task detail page showing task info, run list, expandable provenance tree with costs/tokens.

---

## Week 7: GitHub + Kill Switch

### S-7.1: Push branch

```bash
# Verify push branch function
cat packages/agent/src/github.ts | head -30
```

**Expected:** `pushBranch(sandboxId, repoUrl, goal)` configures git, creates branch `spoke/<taskId>-<slug>`, commits, pushes using GH_TOKEN.

### S-7.2: Create PR

```bash
# Verify create PR function
cat packages/agent/src/github.ts | tail -30
```

**Expected:** `createPr(repoUrl, branch, goal, description?)` creates PR via GitHub API. Returns `{ prUrl, prNumber }`.

### S-7.3: Kill switch

```bash
# Test kill endpoint (requires Postgres)
curl -s -X POST http://localhost:3000/api/tasks/<task-id>/kill

# Verify kill button in UI
open http://localhost:3000/tasks/<task-id>
```

**Expected:** Kill button appears for `running` tasks. POST to `/api/tasks/{id}/kill` sets status to `killed`.

---

## Week 8: Polish + Dogfooding

### S-8.1: Deploy to GCP

```bash
# 1. Verify Dockerfiles
ls apps/*/Dockerfile

# 2. Build an image
docker build -f apps/slack-edge/Dockerfile -t spoke-slack-edge .

# 3. Deploy via Terraform
cd infra/terraform
terraform apply -var="project_id=your-gcp-project"
```

**Expected:** Dockerfiles for all 4 apps. Terraform deploys to Cloud Run with env vars from Secret Manager.

### S-8.2-8.7: Dogfooding

**Manual process:**
1. Deploy Spoke to GCP
2. Send `@spoke <task>` from Slack
3. Wait for Spoke to create a PR
4. Review and merge the PR
5. Repeat for 5 total PRs by Spoke on Spoke

---

## Final Retrospective Checklist

- [ ] All 5 features working end-to-end (Slack → Task → Workflow → Agent → Verification → PR)
- [ ] 5+ PRs by Spoke on Spoke
- [ ] Cost per task < $3
- [ ] Mean time to PR < 5 min
- [ ] Kill switch < 10s propagation
