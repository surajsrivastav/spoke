# SPOKE

**Open Source Product Requirements Document — v3.0**

> Historical product notes only. This repository is MIT-licensed. This document does not alter the project license or add separate commercial terms.

Stable OSS Release — self-hosted, production-grade, operator-first agent control plane.

| Field | Value |
|-------|-------|
| Version | 3.0 — Stable OSS Release |
| Author | Suraj (Distinguished Engineer, Ford Motor Company) |
| Status | Draft |
| Date | June 2026 |
| License | MIT |
| Key change from v2 | Product readiness focus; stable OSS release criteria added |

---

## 1. Purpose

This document defines the product requirements and acceptance criteria for Spoke's first stable open source release.

The stable OSS release must make Spoke a usable, reliable, and trustable self-hosted agent control plane for developers and operators who want to run autonomous coding workflows without depending on continuous IDE or GitHub interaction.

## 2. Vision

Spoke OSS is the control plane for autonomous code work.

Users can submit goals via Slack, WhatsApp, or API, monitor progress in a dashboard, and only merge agent-generated results after verification.

This release is not about IDE plugins or constant GitHub access. It is about safe, observable, operator-managed autonomous execution.

## 3. Strategic goals

- Ship a reproducible self-hosted experience with minimal setup.
- Demonstrate a complete happy path from task submission to verified PR creation.
- Make core OSS capabilities genuinely useful without cloud-only dependencies.
- Provide clear product boundaries between stable OSS and paid cloud features.
- Establish a repeatable release checklist and acceptance criteria for ongoing OSS stability.

## 4. Product principles

- **Operator-first**: Submit tasks through chat/API, review results in a dashboard.
- **Verified output**: No PRs created unless sandbox verification passes.
- **Self-hosted confidence**: Users should be able to deploy locally with Docker Compose and run a full stack.
- **Minimal GitHub dependency**: GitHub is an output channel, not the primary interaction method.
- **Clear separation**: OSS delivers core orchestration and provenance; cloud delivers SSO, RBAC, compliance, SLA.

## 5. Scope for stable OSS release

### In scope

- Local Docker Compose stack with PostgreSQL, Temporal, Operator UI, Orchestrator, Slack Edge, WhatsApp Edge.
- CLI/TUI and API-based task submission.
- Slack and WhatsApp entry points.
- Agent runtime and sandboxed execution.
- Provenance engine with audit trail.
- Verification gates: lint, typecheck, tests inside sandbox.
- GitHub PR creation as an output step.
- MCP Server / GitHub Action / template support as distribution hooks.
- OSS documentation, root `.env.example`, and release readiness guidance.

### Out of scope for OSS stable release

- Managed hosting.
- SSO / enterprise authentication.
- RBAC / team scoping.
- SOC2 / GDPR compliance tooling.
- SLA or commercial support commitments.
- Cloud-only cost governance.

## 6. Stable OSS release success criteria

### 6.1 Product success

- Users can install and launch Spoke locally with one command.
- Users can submit tasks through Slack, WhatsApp, or API.
- Agent workflows execute and complete end to end.
- Verification gates run and determine PR creation.
- Users can inspect provenance, status, and task output in the dashboard.
- The system recovers cleanly from common failures.
- Documentation clearly explains OSS vs Cloud boundaries.

### 6.2 Engineering readiness

- All critical automated tests pass.
- Smoke tests cover the full happy path.
- Dependencies are audited and secure.
- Root license and legal clarity are published.
- Release artifacts are versioned and tagged.

### 6.3 Community readiness

- README has a stable quick start.
- Documentation exists for install, config, and example workflows.
- Contribution and issue triage guidance is available.
- The repository is ready for public consumption.

## 7. Acceptance criteria

### 7.1 Installation & setup

- **Given** a developer has cloned the repo
- **When** they run `cp .env.example .env.local && pnpm install && docker compose -f docker-compose.local.yml up -d`
- **Then** PostgreSQL, Temporal, Operator UI, Orchestrator, Slack Edge, and WhatsApp Edge start successfully
- **And** the dashboard is reachable at `http://localhost:3000`
- **And** environment variables are documented in `README.md` and `.env.example`

### 7.2 Task submission

- **Given** Spoke is running and Slack/WhatsApp webhooks are configured
- **When** an operator sends `@spoke <goal>` in Slack or submits the API payload
- **Then** a task is created in the database with status `pending`
- **And** the operator receives acknowledgment within 2 seconds
- **And** the task appears in the Operator UI

### 7.3 Agent execution

- **Given** a pending task exists with a valid repository and model provider
- **When** the orchestrator workflow runs
- **Then** an isolated sandbox is provisioned and the repository is cloned
- **And** the agent generates a plan and executes file operations
- **And** every tool call is logged to the provenance store
- **And** the task progresses through expected states: `pending → running → verifying → completed`

### 7.4 Verification gates

- **Given** the agent has finished implementation in the sandbox
- **When** verification runs
- **Then** lint, typecheck, and tests run inside the sandbox
- **And** if all pass, the workflow proceeds to create a PR
- **And** if any gate fails, the system retries according to the configured policy and only fails permanently after retries are exhausted
- **And** no PR is created on verification failure

### 7.5 PR output

- **Given** verification passes
- **When** the PR creation step runs
- **Then** a branch is pushed to GitHub
- **And** a PR is opened with the task goal and verification summary
- **And** the PR URL is stored on the task record

### 7.6 Provenance and observability

- **Given** a task has executed
- **When** an operator views it in the UI
- **Then** they can see the full provenance chain of model calls, tool invocations, status transitions, and verification results
- **And** the system records who submitted the task and when

### 7.7 Failure handling

- **Given** the sandbox fails to provision
- **When** the error occurs
- **Then** the workflow retries provisioning up to 3 times with exponential backoff
- **And** on repeated failure the task transitions to `failed`
- **And** the failure reason is visible in the UI and stored in provenance

- **Given** the repository is inaccessible
- **When** `git clone` fails due to missing permissions
- **Then** the task fails immediately with a clear error message and no retries

### 7.8 Documentation & release readiness

- `README.md` contains a stable Quick Start for local OSS install.
- Root `.env.example` exists and documents required runtime variables.
- The OSS release notes explain which features are OSS and which are cloud-only.
- A release checklist is published in `docs/oss/SPOKE_OSS_PRD_v3.md`.

## 8. Release readiness checklist

- [ ] Root `LICENSE` file exists and matches OSS messaging.
- [ ] Root `.env.example` is present.
- [ ] `README.md` quick start is accurate.
- [ ] Docker Compose local stack works end to end.
- [ ] Slack and WhatsApp onboarding examples are documented.
- [ ] Verification gates are implemented and working.
- [ ] PR creation flow works for valid tasks.
- [ ] Provenance logging is available in the UI.
- [ ] GitHub Action / MCP Server hooks are documented.
- [ ] Release version is tagged and changelog draft exists.

## 9. Metrics for stable OSS release

- Time to first task: < 10 minutes from clone to dashboard task creation.
- Full happy path completion rate: > 80% on smoke test.
- Task creation acknowledgment latency: < 2 seconds.
- Verification gate pass rate for valid tasks: > 90%.
- Documentation coverage: install + sample workflow + feature boundaries.

## 10. Next phase after stable OSS release

- Publish Spoke Cloud beta and pilot conversion funnel.
- Launch enterprise-only Cloud features: SSO, RBAC, audit exports.
- Mature Spoke Hub templates and community contribution flows.
- Build a support/feedback path for OSS pilots.
