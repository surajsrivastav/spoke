---
name: writing-architecture-decision-record
description: How to write Architectural Decision Records (ADRs) for Spoke. Use when making a significant design decision (choosing a tech, designing a component, picking between architectures). Covers ADR template, when to write one, how to document tradeoffs.
---

# Writing Architectural Decision Records (ADRs)

## When to Use This Skill

Write an ADR when:
- You're choosing between technologies (e.g., LiteLLM vs OpenRouter)
- You're designing a new system component
- You're changing a fundamental architectural pattern
- You're deciding NOT to do something obvious (negative ADRs)
- A decision will be hard to reverse

**Don't write an ADR for:**
- Trivial decisions (variable naming)
- Decisions that are clearly correct
- Things that can be easily undone

## ADR Format

ADRs live in `docs/adr/` as `<number>-<title>.md`:

```
docs/
└── adr/
    ├── 0001-cloud-provider-gcp.md
    ├── 0002-orchestration-temporal-cloud.md
    ├── 0003-model-gateway-openrouter.md
    ├── 0004-database-postgres-cloud-sql.md
    └── 0005-monorepo-pnpm.md
```

## Standard Template

```markdown
# ADR-XXXX: <Title>

**Status:** <Proposed | Accepted | Superseded | Deprecated | Rejected>  
**Date:** YYYY-MM-DD  
**Decision Makers:** <names>  
**Stakeholders:** <names>  
**Related:** <ADR-XXXX, etc.>

## Context

What is the issue we're seeing? What is the situation? Why is this decision needed?

Include:
- The problem statement
- Constraints (cost, timeline, expertise)
- Stakeholder concerns
- Current state of the system

Avoid:
- Solutions in the context (those go in Decision)
- Vague language ("we should consider")
- Skipping details ("you know the situation")

## Decision

What did we decide? State it clearly.

Example: "We will use Temporal Cloud as our workflow orchestration platform for Phase 0."

This should be one paragraph, no longer.

## Consequences

What are the implications of this decision?

Include:
- **Positive**: What's better as a result?
- **Negative**: What problems does it create?
- **Risk**: What might go wrong?
- **Mitigation**: How do we manage the risks?

## Alternatives Considered

Each alternative should have:
- What it is
- Why we considered it
- Why we didn't choose it

### Alternative 1: <name>
- **What:** Brief description
- **Pros:** Why it's good
- **Cons:** Why it's not chosen

### Alternative 2: <name>
...

## Implementation Notes

(Optional) High-level guidance on implementation. Not detailed code, but:
- Key components affected
- Migration plan
- Rollout strategy
```

## Sample ADR (Real Phase 0 Example)

```markdown
# ADR-0001: Cloud Provider Selection

**Status:** Accepted  
**Date:** 2026-05-30  
**Decision Makers:** Suraj  
**Stakeholders:** Engineering team

## Context

For Spoke Phase 0, we need to pick a cloud provider for the control plane (Cloud Run/Lambda equivalent, database, secrets, observability). The choice affects:
- Time to MVP (simpler is faster)
- Monthly cost
- Operational complexity
- Long-term portability

Three viable options: GCP, AWS, Azure. We need a decision before infrastructure work begins.

Constraints:
- 8-week MVP timeline
- Cost target: <$400/mo for Phase 0
- Team has GCP + AWS experience; limited Azure
- Must support Temporal Cloud + E2B integration

## Decision

We will use **GCP** for Phase 0, with all services deployed in `us-central1`.

Specifically:
- Cloud Run for Slack Edge, Orchestrator, Operator UI
- Cloud SQL (Postgres) for state
- Secret Manager for secrets
- Cloud Logging for observability
- Workload Identity Federation for auth (no API keys)

## Consequences

**Positive:**
- Cloud Run is the best fit for our burst workload (per-request billing)
- Workload Identity removes API key management overhead
- Free tiers cover most Phase 0 usage (Cloud SQL is dominant cost)
- Simpler operational model than AWS (fewer services to configure)
- Temporal Cloud + E2B work identically on any cloud

**Negative:**
- $200-230/mo more expensive than AWS at scale
- Database (Cloud SQL) is the dominant cost; minimum HA tier is expensive
- Some services (logging UX, observability) are weaker than AWS

**Risk:**
- Single-cloud dependency for Phase 0
- Customer mandate might require AWS or Azure for Phase 2+
- Cloud SQL costs scale linearly with task volume

**Mitigation:**
- All infrastructure code in Terraform (~2 weeks to port to AWS)
- All services containerized (portable across clouds)
- Temporal Cloud is cloud-agnostic
- Phase 2 self-hosted option (Helm) further reduces lock-in

## Alternatives Considered

### Alternative 1: AWS
- **What:** Fargate + RDS + Secrets Manager + CloudWatch
- **Pros:** $130/mo (cheaper), mature ecosystem, more reference architectures
- **Cons:** More complex setup (IAM, VPC, etc.), longer time to MVP, less elegant Workload Identity

### Alternative 2: Azure
- **What:** Container Instances + Azure DB + Key Vault
- **Pros:** Per-second billing on compute, decent prices
- **Cons:** Worst operational story (limited auto-scaling), Managed Identity doesn't work with external services (Temporal, E2B), $192.50/mo, team has limited Azure experience

### Alternative 3: Multi-cloud (GCP + AWS)
- **What:** Deploy to both clouds for redundancy
- **Pros:** No vendor lock-in
- **Cons:** 2x operational burden for an MVP, premature optimization

## Implementation Notes

- Use Terraform to provision GCP resources
- Use Workload Identity Federation for all service-to-service auth
- Set up budget alerts at $400/mo
- Plan migration to AWS as a Phase 1 evaluation point
```

## ADR Lifecycle

### When to update an ADR

**Status Change**: Proposed → Accepted → Superseded

Mark as **Superseded** when a new ADR replaces it. Don't delete old ADRs; reference them in the new one.

```markdown
# ADR-0001: Cloud Provider Selection

**Status:** Superseded by ADR-0023 (2027-02-15)
```

### Documenting context that changed

If the situation changes but the decision is still valid, add an addendum:

```markdown
## Addendum (2026-08-15)

Updated for Phase 1: Costs at 100 tasks/day are now $4,500/mo. We're evaluating a migration to AWS Fargate. See ADR-0017 for the analysis.

The decision in this ADR remains correct for Phase 0.
```

## Anti-patterns

### Bad ADRs

- ❌ "We'll use whatever the team prefers" — Not a decision
- ❌ ADR with no alternatives — How do we know it's the right call?
- ❌ "We'll decide later" — Either decide or remove the ADR
- ❌ ADR longer than 2 pages — Too detailed; pull details into separate docs
- ❌ ADR with implementation code — Implementation is separate

### Good ADRs

- ✅ Specific decision (technology, pattern, or constraint)
- ✅ At least 2 alternatives considered
- ✅ Clear consequences (both positive and negative)
- ✅ Stakeholder review before "Accepted"
- ✅ Linked to related ADRs

## ADRs for Spoke Phase 0

Plan these ADRs early:

| # | Title | When |
|---|---|---|
| 0001 | Cloud Provider — GCP | Week 1 |
| 0002 | Workflow Orchestration — Temporal Cloud | Week 1 |
| 0003 | Model Gateway — OpenRouter (configurable) | Week 2 |
| 0004 | Database — Cloud SQL Postgres | Week 1 |
| 0005 | Monorepo — pnpm workspaces | Week 1 |
| 0006 | Sandbox — E2B | Week 2 |
| 0007 | Agent Loop — Claude Agent SDK (Phase 0) | Week 3 |
| 0008 | Frontend — Next.js 15 | Week 5 |
| 0009 | Provenance — Append-only Postgres table | Week 4 |
| 0010 | Operator UI Auth — None for Phase 0 | Week 5 |

Update as decisions emerge.

## Related Skills

- `writing-rfc` — Larger design documents
- `writing-prd` — Product specs
- `evaluating-tech-tradeoffs` — Tech comparison
- `writing-runbook` — Operational follow-up
