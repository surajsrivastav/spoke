# Phase 0 Execution Workflow

How to actually execute the 8-week Phase 0 plan using the Spoke agentic development system.

---

## The Loop

Each piece of work follows this pattern:

```
1. prd-writer     →  user story + AC
2. architect      →  ADR (if design decision needed)
3. feature-impl.  →  code + unit tests
4. qa-engineer    →  integration tests + edge cases
5. code-reviewer  →  PR review
6. integrator     →  merge + changelog
```

**Skip the agent if you're doing the work yourself**, but think in terms of these roles.

---

## Week 1: Foundation

### Goal
Working monorepo, Postgres running locally, schema deployed.

### Stories

#### S-1.1: Bootstrap monorepo
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: writing-pnpm-package, writing-typescript-module
- **AC**:
  ```
  Given an empty directory
  When I run bash bootstrap.sh
  Then a spoke/ monorepo exists with:
    - 3 apps (slack-edge, orchestrator, operator-ui)
    - 4 packages (db, agent, provenance, shared)
    - Working pnpm install
    - tsconfig + eslint + prettier configured
  ```

#### S-1.2: Provision GCP project + Terraform
- **Persona**: admin
- **Agent**: devops-engineer
- **Skills**: writing-terraform-gcp, configuring-cloud-sql, setting-up-secret-manager
- **AC**:
  ```
  Given a fresh GCP project
  When I run terraform apply
  Then the following exists:
    - Cloud SQL instance (Postgres 16)
    - Secret Manager with 6 secrets configured
    - Cloud Run services (3, placeholder containers)
    - Workload Identity Federation set up
  ```

#### S-1.3: Prisma schema + migration
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: writing-prisma-migration
- **AC**:
  ```
  Given a clean Postgres database
  When I run pnpm migrate
  Then 5 tables exist: tasks, task_runs, provenance, traces, pull_requests
  And all foreign keys are in place
  And indexes are created
  ```

---

## Week 2: Slack Edge + Task Creation

### Goal
Slack `@spoke` creates a task row.

### Stories

#### S-2.1: Slack app setup
- **Persona**: admin
- **Agent**: devops-engineer
- **Skills**: integrating-slack-bot
- **AC**:
  ```
  Given a test Slack workspace
  When I create a Slack app for Spoke
  Then the app has:
    - Bot scope: app_mentions:read, chat:write
    - Event subscription for app_mention
    - Slack bot token + signing secret stored in Secret Manager
  ```

#### S-2.2: Slack signature verification
- **Persona**: security
- **Agent**: feature-implementer
- **Skills**: integrating-slack-bot, writing-typescript-module
- **AC**:
  ```
  Given a Slack request without valid signature
  When the request hits /slack/events
  Then the response is 401 Unauthorized

  Given a Slack request with valid signature
  Then the request is processed
  ```

#### S-2.3: Mention handler + task creation
- **Persona**: engineer
- **Agent**: feature-implementer
- **Skills**: writing-hono-api, integrating-slack-bot, writing-prisma-migration
- **AC**: See US-0.1.1 from writing-user-story-gherkin skill

---

## Week 3: Temporal Workflow + Worker

### Goal
Task goes from "pending" to "running" — worker picks it up.

### Stories

#### S-3.1: Temporal Cloud namespace
- **Persona**: admin
- **Agent**: devops-engineer
- **Skills**: integrating-temporal-workflow
- **AC**:
  ```
  Given a fresh Temporal Cloud account
  When I create a namespace "spoke-dev"
  Then the namespace exists
  And API credentials are in Secret Manager
  And the worker can connect
  ```

#### S-3.2: Define agentTaskWorkflow
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-temporal-workflow, writing-typescript-module
- **AC**:
  ```
  Given a task with id "task_abc"
  When agentTaskWorkflow is invoked with input {taskId, goal, repoUrl}
  Then it executes the following activities in order:
    1. updateTaskStatus(running)
    2. provisionSandbox(...)
    3. runAgent(...)
    4. verify(...)
    5. pushBranch(...)
    6. createPr(...)
    7. updateTaskStatus(succeeded)
  And on any failure, status is updated to "failed"
  And finally, destroySandbox is called
  ```

#### S-3.3: Stub all activities
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: writing-typescript-module
- **AC**:
  ```
  Given the orchestrator worker is running
  When a workflow is started
  Then all activities are registered and called
  And each activity logs its invocation
  And no real external calls are made (stubs return mock data)
  ```

#### S-3.4: Slack → Temporal trigger
- **Persona**: engineer
- **Agent**: feature-implementer
- **Skills**: integrating-temporal-workflow, integrating-slack-bot
- **AC**:
  ```
  Given a Slack mention is received
  And a task is created
  When the workflow is started
  Then the task ID is the workflow ID
  And the workflow appears in Temporal UI
  ```

---

## Week 4: Agent Loop + E2B Sandbox

### Goal
Real Claude API call generates code in real E2B sandbox.

### Stories

#### S-4.1: Provision E2B sandbox
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-e2b-sandbox, integrating-temporal-workflow
- **AC**: See US-0.2.1

#### S-4.2: Claude Agent SDK integration
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-claude-agent-sdk, integrating-openrouter
- **AC**:
  ```
  Given a Claude API key
  When I call runAgentLoop(sandboxId, goal, ...)
  Then a Claude conversation starts
  And tool calls are routed to executeToolCall
  And shell/file_read/file_write/git tools work
  And cost cap of $5 is enforced
  ```

#### S-4.3: Tool execution in sandbox
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-e2b-sandbox, integrating-claude-agent-sdk
- **AC**:
  ```
  Given a tool call: shell("npm install")
  When the tool is executed
  Then the command runs in the sandbox
  And the result (stdout, stderr, exit code) is returned
  And the agent receives the result
  ```

---

## Week 5: Verification + Provenance

### Goal
Failed tests trigger retry; everything logged.

### Stories

#### S-5.1: Verification gates
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-e2b-sandbox
- **AC**:
  ```
  Given an agent has produced changes
  When verification runs in sandbox
  Then it runs (in order):
    1. eslint (npm run lint)
    2. tsc (pnpm typecheck)
    3. pnpm test
  And returns { passed: bool, errors: { lint?, typecheck?, tests? } }
  ```

#### S-5.2: Provenance writes
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: writing-typescript-module, writing-prisma-migration
- **AC**:
  ```
  Given any agent action
  When the action completes
  Then a provenance row is inserted
  And the row has: id, task_run_id, type, payload, cost_usd, tokens, duration_ms
  And the table is append-only (no UPDATE allowed)
  ```

#### S-5.3: Agent retry logic
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-claude-agent-sdk, integrating-temporal-workflow
- **AC**:
  ```
  Given verification fails (tests fail)
  When the workflow retries
  Then the agent receives the test errors as input
  And re-runs the loop
  And max 2 retries
  ```

---

## Week 6: Operator UI

### Goal
Open localhost:3000, see live task running.

### Stories

#### S-6.1: Next.js setup
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: writing-react-component, writing-typescript-module
- **AC**:
  ```
  Given the operator-ui package
  When I run pnpm dev
  Then a Next.js app starts on :3000
  And TypeScript is configured
  And Tailwind is configured
  ```

#### S-6.2: Fleet grid with SSE
- **Persona**: operator
- **Agent**: feature-implementer
- **Skills**: writing-react-component, writing-hono-api
- **AC**:
  ```
  Given multiple tasks in different states
  When the operator opens /
  Then a grid shows all tasks
  And each card shows: id, goal, repo, status (color-coded)
  And updates are live via SSE (no polling)
  ```

#### S-6.3: Trace viewer
- **Persona**: operator
- **Agent**: feature-implementer
- **Skills**: writing-react-component
- **AC**:
  ```
  Given a task_id
  When the operator visits /tasks/<id>
  Then provenance is shown as a tree
  And each node is expandable
  And costs + tokens per node are visible
  ```

---

## Week 7: GitHub + Kill Switch

### Goal
Real PRs created. Operator can kill tasks.

### Stories

#### S-7.1: Push branch
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-e2b-sandbox, integrating-github-api
- **AC**:
  ```
  Given a sandbox with committed changes
  When pushBranch is called
  Then the changes are pushed to GitHub
  And a branch name is returned
  And the branch exists in the remote
  ```

#### S-7.2: Create PR
- **Persona**: developer
- **Agent**: feature-implementer
- **Skills**: integrating-github-api
- **AC**:
  ```
  Given a pushed branch
  When createPr is called
  Then a PR is created via GitHub API
  And the PR has: title (from goal), description (from agent), body markdown
  And the PR URL is returned
  And the PR is also linked to the task in DB
  ```

#### S-7.3: Kill switch
- **Persona**: operator
- **Agent**: feature-implementer
- **Skills**: writing-react-component, integrating-temporal-workflow
- **AC**:
  ```
  Given a task in status "running"
  When the operator clicks "Kill" in the UI
  Then a Temporal signal "kill" is sent
  And the workflow catches the signal
  And task status is updated to "killed" within 10s
  And the sandbox is destroyed
  And the engineer is notified in Slack
  ```

---

## Week 8: Polish + Dogfooding

### Goal
**5 PRs on Spoke authored by Spoke.**

### Stories

#### S-8.1: Deploy to GCP
- **Persona**: admin
- **Agent**: devops-engineer
- **Skills**: writing-terraform-gcp, configuring-cloud-run
- **AC**:
  ```
  Given a built Docker image
  When I run terraform apply
  Then 3 Cloud Run services are deployed
  And they can communicate via private VPC
  And secrets are accessible via Workload Identity
  ```

#### S-8.2: First Spoke task (dogfooding)
- **Persona**: engineer
- **Agent**: integrator
- **Skills**: All Phase 0 skills
- **AC**:
  ```
  Given Spoke deployed to production
  When I send "@spoke fix the logging in slack-edge"
  Then Spoke creates a PR
  And the PR fixes the actual bug
  And tests pass
  And I merge it
  ```

#### S-8.3-8.7: 4 more dogfooding tasks
- Each story = one PR by Spoke on Spoke
- Examples:
  - Add JSDoc to provenance writer
  - Refactor cost cap to use better types
  - Add Slack thread updates
  - Add health check endpoints

---

## How to Execute

### Daily flow

```bash
# Morning: pick a story from the current week
# Run the prd-writer agent (or do it yourself with the skill):
# - Refine the AC if needed
# - Update Definition of Done

# Mid-day: implement
# Run the feature-implementer agent:
# - Apply relevant skills
# - Write code + unit tests
# - Apply writing-typescript-module patterns
# - Apply integrating-* skills as needed

# Afternoon: review
# Run the qa-engineer agent:
# - Write integration test
# - Identify edge cases
# - Validate AC

# End of day: prepare PR
# Run the code-reviewer agent:
# - Apply code-review-typescript skill
# - Apply security-review skill
# - Submit PR

# Next morning: integrate
# Run the integrator agent:
# - Merge if approved
# - Update CHANGELOG
```

### Weekly cadence

- Monday: plan stories for the week
- Tuesday-Thursday: execute (1-2 stories/day)
- Friday: integrate, dogfood, write retrospective

---

## Tracking

### Maintain `docs/PHASE_0_PROGRESS.md`

```markdown
# Phase 0 Progress

## Week 1: Foundation
- [x] S-1.1: Bootstrap monorepo
- [x] S-1.2: Provision GCP + Terraform
- [ ] S-1.3: Prisma schema

## Week 2: Slack Edge
- [ ] S-2.1: Slack app setup
- [ ] S-2.2: Signature verification
- [ ] S-2.3: Mention handler

...
```

### Update after each story

- Status: complete / in-progress / blocked
- Notes: what worked, what didn't, what surprised
- Time: actual vs planned

---

## When Things Go Wrong

### Story takes longer than expected
- Don't expand scope; finish what you have
- File a follow-up story for missing parts
- Update PHASE_0_PROGRESS.md with reality

### Bug found during dogfooding
- Don't fix it manually
- Use Spoke to fix it (test the dogfooding loop)
- If it can't fix it, file as a bug

### Architecture decision needed mid-week
- Pause coding
- Run the architect agent
- Write ADR before continuing
- Don't skip ADR documentation

---

## End-of-Phase-0 Retrospective

After 8 weeks, evaluate:
- ✅ All 5 features working end-to-end?
- ✅ 5+ PRs by Spoke on Spoke?
- ✅ Cost per task <$3?
- ✅ Mean time to PR <5 min?
- ✅ Kill switch <10s propagation?

If yes → Phase 1.  
If no → identify what blocked progress, fix in Phase 0.5.

---

**Owner:** Suraj  
**Sprint Cadence:** 1-week sprints with Friday demos  
**Demo Audience:** Self + any early customer
