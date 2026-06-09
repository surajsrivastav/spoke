# Harness Development Skills

Skills are **reusable capabilities** that any agent can invoke. Each skill is a directory under `.harness/skills/<skill-name>/` containing at minimum a `SKILL.md` file.

**Skill file format:**
```markdown
---
name: <skill-name>
description: When to use this skill (triggers Claude to load it)
---

## Overview
What this skill enables.

## When to Use
- Trigger 1
- Trigger 2

## How to Apply
Step-by-step guidance.

## Examples
Concrete code examples.

## Anti-patterns
What NOT to do.

## Related Skills
Other skills that often pair with this one.
```

---

## Skill Categories

### 1. Documentation & Specification

| Skill | Purpose |
|---|---|
| `writing-rfc` | Request for Comments — Large design proposals |
| `writing-prd` | Product Requirements Document — Feature spec |
| `writing-architecture-decision-record` | ADR — One-shot design decisions |
| `writing-user-story-gherkin` | Story format with acceptance criteria |
| `scoping-feature` | Decompose features into stories |
| `defining-acceptance-criteria` | Testable, unambiguous criteria |
| `writing-runbook` | Operational procedures |

### 2. TypeScript/Node Development

| Skill | Purpose |
|---|---|
| `writing-typescript-module` | Standard TS module patterns |
| `writing-pnpm-package` | Monorepo package structure |
| `writing-hono-api` | Backend API endpoint patterns |
| `writing-react-component` | Frontend components (React 18+) |
| `writing-prisma-migration` | Database schema changes |
| `writing-zod-schema` | Runtime validation schemas |

### 3. Integration Skills

| Skill | Purpose |
|---|---|
| `integrating-temporal-workflow` | Temporal Cloud workflow patterns |
| `integrating-e2b-sandbox` | E2B sandbox provisioning |
| `integrating-claude-agent-sdk` | Claude Agent SDK patterns |
| `integrating-openrouter` | Multi-model gateway |
| `integrating-slack-bot` | Slack Bolt + event handlers |
| `integrating-whatsapp-bot` | WhatsApp Cloud API + webhook handlers |
| `integrating-github-api` | GitHub API for PR creation |
| `integrating-cloud-sql` | Postgres connection patterns |
| `integrating-secret-manager` | GCP Secret Manager auth |

### 4. Testing

| Skill | Purpose |
|---|---|
| `writing-unit-test-typescript` | Vitest unit tests |
| `writing-integration-test` | Cross-module testing |
| `writing-e2e-test` | Full-stack tests |
| `identifying-edge-cases` | Property-based thinking |
| `setting-up-test-fixtures` | Reusable test data |
| `analyzing-test-failures` | Debugging failing tests |

### 5. Code Quality

| Skill | Purpose |
|---|---|
| `code-review-typescript` | TypeScript review checklist |
| `security-review` | Auth, secrets, injection, XSS |
| `performance-review` | Async, allocation, queries |
| `verifying-conventions` | Codebase patterns |
| `reviewing-tests` | Test quality assessment |
| `reviewing-documentation` | ADR + comment quality |

### 6. Infrastructure (DevOps)

| Skill | Purpose |
|---|---|
| `writing-terraform-gcp` | GCP infrastructure as code |
| `configuring-cloud-run` | Cloud Run deployment |
| `configuring-cloud-sql` | Postgres setup |
| `setting-up-workload-identity` | Auth without API keys |
| `setting-up-secret-manager` | Secret storage |
| `writing-github-actions` | CI/CD workflows |

### 7. Release & Integration

| Skill | Purpose |
|---|---|
| `resolving-merge-conflict` | Git conflict resolution |
| `preparing-release` | Release workflow |
| `updating-changelog` | Semver + release notes |
| `tagging-commits` | Git tag management |
| `running-migration-rollouts` | Schema migration safety |

---

## Skill Files Created

The following SKILL.md files are provided as starting points. Add more as needed.

- `writing-typescript-module/SKILL.md`
- `writing-prisma-migration/SKILL.md`
- `integrating-temporal-workflow/SKILL.md`
- `integrating-e2b-sandbox/SKILL.md`
- `integrating-claude-agent-sdk/SKILL.md`
- `writing-user-story-gherkin/SKILL.md`
- `writing-terraform-gcp/SKILL.md`
- `code-review-typescript/SKILL.md`
- `writing-unit-test-typescript/SKILL.md`
- `writing-architecture-decision-record/SKILL.md`

---

## How Agents Use Skills

### Auto-discovery (preferred)

Agent reads its definition, sees skill name, finds SKILL.md, applies guidance.

Example: `feature-implementer` working on database schema:
1. Reads `agents/feature-implementer.md`
2. Sees `writing-prisma-migration` listed in primary skills
3. Loads `skills/writing-prisma-migration/SKILL.md`
4. Applies the guidance

### Explicit invocation

Inside a prompt or task:
```
"Apply the integrating-temporal-workflow skill"
```

### Multi-skill composition

Many tasks require multiple skills:
```
Task: "Build the Slack mention handler"
Skills used:
  - writing-hono-api (route handler)
  - integrating-slack-bot (Slack Bolt patterns)
  - integrating-temporal-workflow (trigger workflow)
  - writing-zod-schema (request validation)
  - writing-unit-test-typescript (tests)
```

---

## Adding a New Skill

When you find yourself doing the same thing twice:

1. Create `.harness/skills/<skill-name>/SKILL.md`
2. Use the template (see top of this document)
3. Add to the agent(s) that should use it
4. Update this index

---

## Versioning

This document version: 1.0  
Last updated: May 30, 2026
