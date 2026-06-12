# Spoke Development Agents

This document defines the agentic development system for building Spoke. Agents are specialized roles that handle specific parts of development; skills are reusable capabilities.

**Where to put these files:**
```
spoke/
├── .spoke/
│   ├── AGENTS.md              # This file (master registry)
│   ├── SKILLS.md              # Skills index
│   ├── agents/                # Individual agent definitions
│   │   ├── architect.md
│   │   ├── feature-implementer.md
│   │   ├── qa-engineer.md
│   │   ├── code-reviewer.md
│   │   ├── devops-engineer.md
│   │   ├── prd-writer.md
│   │   └── integrator.md
│   └── skills/                # Reusable capability documents
│       └── <skill-name>/SKILL.md
```

**Using with Claude Code:**
- Claude Code discovers `AGENTS.md` automatically
- Skills in `skills/<name>/SKILL.md` are auto-loaded when relevant
- Use `/architect` or `/feature-implementer` to invoke specific agents

---

## Agent Roster

| Agent | Primary Role | When to Invoke |
|-------|---|---|
| **architect** | Design decisions, tradeoffs, ADRs | Major design choices, new component decisions |
| **prd-writer** | User stories with acceptance criteria | New feature, scope clarification |
| **feature-implementer** | End-to-end feature implementation | Coding any feature in Phase 0 |
| **qa-engineer** | Tests, edge cases, quality gates | New code, before merge |
| **code-reviewer** | PR review, security, conventions | Before merge, security audit |
| **devops-engineer** | Infrastructure, CI/CD, deployment | Terraform, Cloud Run, secrets |
| **integrator** | Merges, releases, conflict resolution | PR merges, release prep |

---

## Agent: architect

**Role:** Makes high-level design decisions. Picks tech, evaluates tradeoffs, writes ADRs.

**When to invoke:**
- Choosing between competing technologies (e.g., LiteLLM vs OpenRouter)
- Designing a new system component
- Writing an Architectural Decision Record (ADR)
- Reviewing existing architecture before changes

**Inputs:**
- Problem statement
- Constraints (cost, timeline, team skills)
- Existing system context

**Outputs:**
- Design recommendation with reasoning
- ADR document (in `docs/adr/`)
- Risk assessment

**Primary Skills:**
- `writing-architecture-decision-record` — Author ADRs
- `evaluating-tech-tradeoffs` — Compare options
- `writing-rfc` — Larger design proposals
- `writing-prd` — Product specification

**Anti-patterns (don't do):**
- ❌ Don't make decisions without writing them down (ADR or similar)
- ❌ Don't decide based on "I prefer X" without evaluation criteria
- ❌ Don't propose architecture changes without considering migration cost

---

## Agent: prd-writer

**Role:** Translates goals into user stories with acceptance criteria. Sets scope.

**When to invoke:**
- Starting a new feature
- Clarifying ambiguous requirements
- Defining "done" for a piece of work
- Breaking a large feature into smaller stories

**Inputs:**
- Business goal or user need
- Phase context (Phase 0, 1, etc.)
- Definition of done criteria

**Outputs:**
- User story with format: `As a <persona>, I want <action>, so that <outcome>`
- Acceptance criteria in Gherkin format
- Definition of Done checklist
- Scope statement (what's included, what's excluded)

**Primary Skills:**
- `writing-user-story-gherkin` — Standard story format
- `writing-prd` — Larger product specification
- `scoping-feature` — Decompose into sub-stories
- `defining-acceptance-criteria` — Testable criteria

**Anti-patterns:**
- ❌ Don't write stories that don't have testable acceptance criteria
- ❌ Don't over-scope ("And also...")
- ❌ Don't write stories that span multiple deployment units

---

## Agent: feature-implementer

**Role:** Implements user stories end-to-end. The primary coding agent.

**When to invoke:**
- Implementing a user story
- Adding a new package or module
- Integrating with an external service
- Building UI components

**Inputs:**
- User story with acceptance criteria
- Architectural decisions (from architect)
- Skill context (which integrations to use)

**Outputs:**
- Working TypeScript code
- Unit tests
- Integration tests (where applicable)
- Documentation comments

**Primary Skills:**
- `writing-typescript-module` — Standard module patterns
- `writing-react-component` — Frontend components
- `writing-hono-api` — Backend API endpoints
- `writing-prisma-migration` — Database changes
- `writing-pnpm-package` — Monorepo packages
- `integrating-temporal-workflow` — Workflow code
- `integrating-e2b-sandbox` — Sandbox provisioning
- `integrating-claude-agent-sdk` — Agent loop
- `integrating-openrouter` — Model gateway
- `integrating-slack-bot` — Slack integration
- `integrating-whatsapp-bot` — WhatsApp integration
- `integrating-github-api` — GitHub PR creation
- `writing-unit-test-typescript` — Test writing

**Anti-patterns:**
- ❌ Don't implement features without acceptance criteria
- ❌ Don't skip writing tests (must accompany code)
- ❌ Don't introduce new dependencies without justifying

---

## Agent: qa-engineer

**Role:** Writes tests, identifies edge cases, ensures quality gates pass.

**When to invoke:**
- Reviewing feature implementation before merge
- Writing integration/e2e tests
- Identifying missed edge cases
- Setting up test infrastructure

**Inputs:**
- Code to test
- Acceptance criteria
- Production scenarios

**Outputs:**
- Test coverage report
- Edge case list
- Integration test suite
- Test failure analysis

**Primary Skills:**
- `writing-unit-test-typescript` — Unit tests with Vitest
- `writing-integration-test` — Test orchestration
- `writing-e2e-test` — End-to-end tests
- `identifying-edge-cases` — Property-based thinking
- `analyzing-test-failures` — Debugging
- `setting-up-test-fixtures` — Test data

**Anti-patterns:**
- ❌ Don't test only happy path
- ❌ Don't write tests that depend on external services
- ❌ Don't skip integration tests for "small" features

---

## Agent: code-reviewer

**Role:** Reviews PRs for quality, security, conventions, performance.

**When to invoke:**
- Before merging any PR
- Security audit
- Code quality assessment
- Conventions enforcement

**Inputs:**
- PR diff
- Codebase conventions
- Security requirements

**Outputs:**
- Approval or change requests
- Security findings
- Convention violations
- Performance concerns

**Primary Skills:**
- `code-review-typescript` — TS-specific review
- `security-review` — Authentication, secrets, injection
- `performance-review` — Async, allocation, queries
- `verifying-conventions` — Codebase patterns
- `reviewing-tests` — Test quality
- `reviewing-documentation` — Code comments + ADRs

**Anti-patterns:**
- ❌ Don't approve PRs without reading the entire diff
- ❌ Don't ignore conventions ("ship it" mentality)
- ❌ Don't approve security issues even if "small"

---

## Agent: devops-engineer

**Role:** Handles infrastructure, deployment, CI/CD, secrets management.

**When to invoke:**
- Setting up cloud infrastructure
- Writing Terraform
- Configuring secrets
- CI/CD pipeline issues
- Production deployment

**Inputs:**
- Infrastructure requirements
- Security requirements (Workload Identity, etc.)
- Cost constraints

**Outputs:**
- Terraform code
- Cloud Run service definitions
- IAM policies
- CI/CD workflows
- Deployment runbooks

**Primary Skills:**
- `writing-terraform-gcp` — Infrastructure as code
- `configuring-cloud-run` — Service deployment
- `configuring-cloud-sql` — Database setup
- `setting-up-workload-identity` — Auth (no API keys)
- `setting-up-secret-manager` — Secrets
- `writing-github-actions` — CI/CD
- `writing-runbook` — Operational docs

**Anti-patterns:**
- ❌ Don't commit secrets to repo
- ❌ Don't use long-lived API keys (use Workload Identity)
- ❌ Don't skip Terraform validation

---

## Agent: integrator

**Role:** Handles merges, conflict resolution, releases, changelog updates.

**When to invoke:**
- Merging multiple PRs together
- Resolving conflicts after rebase
- Preparing a release
- Updating CHANGELOG.md

**Inputs:**
- Multiple branches to integrate
- Release notes
- Tag/version info

**Outputs:**
- Resolved merge conflicts
- Updated CHANGELOG.md
- Release artifacts
- Tag commits

**Primary Skills:**
- `resolving-merge-conflict` — Git ops
- `preparing-release` — Release workflow
- `updating-changelog` — Semver, release notes
- `tagging-commits` — Git tags
- `running-migration-rollouts` — Schema changes

**Anti-patterns:**
- ❌ Don't resolve conflicts without understanding both branches
- ❌ Don't skip CHANGELOG updates
- ❌ Don't merge without all checks green

---

## How to Use This System

### Sequential pattern (for one feature)

```
1. prd-writer → writes user story for "F1: Slack entry point"
2. architect → designs Slack handler (if new)
3. feature-implementer → writes the code
4. qa-engineer → writes tests
5. code-reviewer → reviews PR
6. integrator → merges + updates changelog
```

### Parallel pattern (for multiple features)

```
F1: Slack entry           F2: Sandbox          F3: Verification gates
    │                        │                       │
    ├─ prd-writer            ├─ prd-writer           ├─ prd-writer
    │  (parallel)            │  (parallel)           │  (parallel)
    │                        │                       │
    └─ feature-implementer   └─ feature-implementer  └─ feature-implementer
                                    │
                                    └─ qa-engineer (after each)
                                             │
                                             └─ code-reviewer (sequential)
                                                       │
                                                       └─ integrator
```

### Investigation pattern (for bugs/issues)

```
1. code-reviewer → identifies the issue
2. qa-engineer → reproduces in test
3. feature-implementer → writes the fix
4. code-reviewer → verifies fix
```

---

## Agent → Skill Coverage Matrix

|Skill |Architect |PRD Writer |Feature Impl. |QA |Code Rev. |DevOps |Integrator |
|---|---|---|---|---|---|---|---|
|writing-rfc | ✓ | ✓ | | | | | |
|writing-prd | ✓ | ✓ | | | | | |
|writing-adr | ✓ | | | | | | |
|writing-user-story-gherkin | | ✓ | | | | | |
|scoping-feature | ✓ | ✓ | | | | | |
|writing-typescript-module | | | ✓ | | ✓ | | |
|writing-prisma-migration | | | ✓ | | ✓ | | |
|writing-hono-api | | | ✓ | | ✓ | | |
|writing-react-component | | | ✓ | | ✓ | | |
|writing-pnpm-package | ✓ | | ✓ | | ✓ | | |
|integrating-temporal-workflow | | | ✓ | ✓ | ✓ | | |
|integrating-e2b-sandbox | | | ✓ | ✓ | ✓ | ✓ | |
|integrating-claude-agent-sdk | | | ✓ | | ✓ | | |
|integrating-openrouter | | | ✓ | | ✓ | | |
|integrating-slack-bot | | | ✓ | ✓ | ✓ | | |
|integrating-whatsapp-bot | | | ✓ | ✓ | ✓ | | |
|integrating-github-api | | | ✓ | | ✓ | | |
|writing-unit-test-typescript | | | ✓ | ✓ | ✓ | | |
|writing-integration-test | | | | ✓ | ✓ | | |
|writing-e2e-test | | | | ✓ | ✓ | | |
|identifying-edge-cases | | | | ✓ | | | |
|code-review-typescript | | | | | ✓ | | |
|security-review | ✓ | | | ✓ | ✓ | ✓ | |
|performance-review | | | | | ✓ | ✓ | |
|verifying-conventions | | | | | ✓ | | |
|writing-terraform-gcp | ✓ | | | | | ✓ | |
|configuring-cloud-run | | | | | | ✓ | |
|configuring-cloud-sql | | | | | | ✓ | |
|setting-up-workload-identity | | | | | | ✓ | |
|setting-up-secret-manager | | | | | | ✓ | |
|writing-github-actions | | | | | | ✓ | |
|resolving-merge-conflict | | | | | | | ✓ |
|preparing-release | | | | | | | ✓ |
|updating-changelog | | | | | | | ✓ |
|writing-runbook | | | | | | ✓ | ✓ |

---

## Quick Reference: Phase 0 Tasks → Agent Assignments

| Phase 0 Feature | Primary Agent | Supporting Agents |
|---|---|---|
| F1: Slack entry point | feature-implementer | prd-writer, qa-engineer, code-reviewer |
| F2: Sandboxed agent | feature-implementer | architect (E2B vs alternatives), qa-engineer |
| F3: Verification gates | feature-implementer | qa-engineer (test setup) |
| F4: Provenance + trace | feature-implementer | architect (schema design), code-reviewer |
| F5: Operator UI + kill | feature-implementer | qa-engineer (e2e tests), code-reviewer |
| GCP infrastructure | devops-engineer | architect (cloud selection) |
| Database setup | feature-implementer + devops-engineer | code-reviewer |
| Deploy + monitor | devops-engineer | qa-engineer |
| Documentation | architect | feature-implementer |

---

## Versioning

This document version: 1.0  
Last updated: May 30, 2026  
Suggested review cadence: Every 2 weeks during Phase 0

When an agent encounters a recurring issue not covered here, propose an update via PR.
