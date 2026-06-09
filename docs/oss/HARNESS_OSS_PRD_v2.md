# HARNESS

**Open Source Product Requirements Document — v2.0**

Cloud-First Monetisation Strategy — OSS is free forever. Enterprise features live in Harness Cloud only.

| Field | Value |
|-------|-------|
| Version | 2.0 — Cloud-First Edition |
| Author | Suraj (Distinguished Engineer, Ford Motor Company) |
| Status | Draft |
| Date | May 2026 |
| License | AGPL v3 (OSS core) + Harness Cloud (paid) |
| Key change from v1 | SSO, RBAC, compliance moved exclusively to Harness Cloud |

---

## 1. Strategy: The Cloud-First Model

The v1 PRD proposed three revenue streams: Harness Cloud, Enterprise Self-Hosted License, and Consulting. This version makes a decisive simplification: SSO, RBAC, security compliance, and all enterprise governance features are exclusive to Harness Cloud. There is no enterprise self-hosted tier.

### 1.1 The Model

| Dimension | OSS (Free) | Harness Cloud (Paid) |
|-----------|-----------|---------------------|
| Hosting | Self-hosted (Docker Compose, Helm) | Managed by Harness |
| Price | Free forever | $299 / $999 / $4,999 per month |
| SSO / SAML / OIDC | No | Yes — Enterprise tier only |
| RBAC | No | Yes — Enterprise tier only |
| SOC2 compliance | No | Yes — Enterprise tier |
| GDPR tools | No | Yes — Enterprise tier |
| Audit log export | No | Yes — Growth + Enterprise |
| Multi-team budgets | No | Yes — Enterprise tier |
| SLA | No | 99% to 99.9% |
| Support | Community Discord | Email / Slack / Dedicated CSM |
| Target user | OSS contributor, individual operator | Team, department, enterprise |

### 1.2 Why This Works

- **Simplicity** — two offerings, clear choice. No confusion between self-hosted enterprise vs cloud.
- **Stronger cloud pull** — enterprise features only in cloud creates a gravitational pull toward the managed product.
- **OSS stays clean** — no artificial feature limits that frustrate the community. Core fleet management is fully free.
- **Faster sales** — "need SSO? cloud only" shortens the enterprise procurement conversation.
- **Higher gross margin** — managed cloud with enterprise features commands premium pricing without the cost of self-hosted support contracts.

### 1.3 What OSS Keeps (Deliberately)

The OSS version is not crippled. It has everything an operator needs to run a real agent fleet:

- Full orchestration (Temporal-backed persistent server)
- Complete provenance and audit trail (append-only Postgres)
- Operator dashboard with real-time fleet view and kill switch
- Cost tracking (per task, per agent)
- All agent adapters (LangGraph, AutoGen, custom)
- GitHub Action, MCP Server, CLI with TUI
- YAML pipeline definitions
- Harness Hub template marketplace

**What it does not have**: managed hosting, SSO, RBAC, compliance exports, SLA, dedicated support.

### 1.4 The On-Prem Enterprise Problem

> ⚠️ Open question: Air-gapped enterprises (Ford)

Ford and similarly regulated enterprises cannot send production code to external cloud. If SSO and compliance are cloud-only, Ford cannot use the paid Harness product. Two paths:

- **(A) Cloud only (current)** — Harness Cloud runs on Harness infrastructure. Customers send tasks to cloud. Simple subscription. Not Ford-viable.
- **(B) Cloud On-Prem** — Harness team deploys and manages Harness inside customer VPC. Customer pays for this service. Premium subscription + setup fee. Ford-viable.
- ~~(C) Enterprise self-hosted (v1 model)~~ — Customer runs Helm chart themselves. Harness sells a commercial license. Adds operational support burden with low margin — avoid.

**Recommendation**: Start with Option A (cloud only). Add Option B (Cloud On-Prem) as a Phase 3 premium offering at $10,000+/month.

---

## 2. Pricing

### 2.1 Pricing Table

| | OSS | STARTER | GROWTH | ENTERPRISE |
|---|-----|---------|--------|------------|
| Price | Free forever | $299/mo | $999/mo | $4,999/mo |
| Hosting | Self-hosted | Harness Cloud | Harness Cloud | Harness Cloud |
| Concurrent agents | 50 | 50 | 300 | 2,000 |
| Tasks / mo | Unlimited | 50 | 300 | 2,000 |
| Operators | Unlimited | 3 | 10 | Unlimited |
| SSO / SAML / OIDC | — | — | — | ✓ |
| SOC2 / GDPR export | — | — | — | ✓ |
| Audit log export | — | — | Basic | Full |
| RBAC + team scoping | — | — | — | ✓ |
| Support | Community | Email | Priority Slack | Dedicated CSM |
| SLA | — | 99% | 99.5% | 99.9% |
| Overage | — | $8/task | $5/task | $3/task |
| Annual | free | 10% off | 15% off | 20% off |

### 2.2 Pricing Rationale

| Price point | Why |
|-------------|-----|
| **$299** | Under the $300 auto-renewal mental threshold. Single approver. No procurement. |
| **$999** | Under $1,000/month — the single-approver limit at most companies. One person can say yes. |
| **$4,999** | Under $5,000/month threshold. ~$60K ACV annual. Requires VP approval, not CFO. |
| **No free cloud tier** | Avoids support cost from non-converting users. Community uses OSS self-hosted instead. |

### 2.3 Enterprise Tier: What Justifies the Price

The enterprise tier at $4,999/month ($60K ACV annual) is justified entirely by the enterprise-only features:

- **SSO** — removes per-user credential management. Procurement requires it.
- **RBAC** — required for multi-team deployments. Prevents operators from touching other teams' agents.
- **SOC2** — mandatory for security review in financial services, healthcare, automotive.
- **GDPR tools** — required for EU data residency. Legal team requires it.
- **Audit log export** — required for compliance audits and SIEM ingestion.
- **99.9% SLA** — required for tier-1 enterprise procurement. Non-negotiable.
- **Dedicated CSM** — enterprise buying process requires a named human contact.

Each of these is a procurement checkbox, not a nice-to-have. The enterprise tier sells itself to the security and procurement teams.

### 2.4 Annual Contract Incentives

| Tier | Monthly | Annual (billed yearly) | Saving |
|------|---------|----------------------|--------|
| Starter | $299/mo | $2,868/yr ($239/mo) | $600 |
| Growth | $999/mo | $9,590/yr ($799/mo) | $2,400 |
| Enterprise | $4,999/mo | $47,990/yr ($3,999/mo) | $12,000 |

Annual contracts improve cash flow, reduce churn, and justify longer sales cycles. Push annual from day one for Enterprise.

---

## 3. Feature Split: OSS vs Cloud

> **Legend**: OSS = included in open source (free forever) | Cloud = Harness Cloud only (paid)

| ID | Feature | Description | Tier |
|----|---------|-------------|------|
| F-01 | Docker Compose | Full local stack in one command: Temporal, Postgres, sandbox, UI. Zero cloud accounts. | OSS |
| F-02 | CLI + TUI | `harness run "..."` with live terminal: steps, cost, kill switch, tool calls. | OSS |
| F-03 | Bring Your Own Agent | Register any agent: LangGraph, AutoGen, CLI wrapper, custom function. | OSS |
| F-04 | Provenance engine | Append-only audit log. Every tool call, file changed, model response. | OSS |
| F-05 | Operator dashboard | Live fleet view. Kill any task. Cost tracking. SSE real-time updates. | OSS |
| F-06 | GitHub Action | Label an issue → agent runs → PR opens. Passive distribution. | OSS |
| F-07 | MCP Server | Harness as MCP tool. Claude Code and Cursor can call `harness.run_parallel()`. | OSS |
| F-08 | LangGraph adapter | Native Python adapter for LangGraph compiled graphs. | OSS |
| F-09 | AutoGen adapter | Native adapter for Microsoft AutoGen agents. | OSS |
| F-10 | YAML pipelines | Declarative multi-agent workflows. plan → implement → review → pr. | OSS |
| F-11 | Harness Hub (templates) | Community template marketplace. Publish and consume agent task templates. | OSS |
| F-12 | OpenTelemetry export | Emit OTEL spans to Datadog, Grafana, Jaeger. Plugs into existing observability. | OSS |
| F-13 | Managed hosting | We run the server. No infra management. Auto-scaling. Backups. | Cloud |
| F-14 | SSO — SAML, OIDC | Google Workspace, Okta, Azure AD, any SAML 2.0 provider. | Cloud |
| F-15 | RBAC + team scoping | Roles: admin, operator, viewer. Per-team agent limits and budget caps. | Cloud |
| F-16 | SOC2 compliance | Annual SOC2 Type II report. Shared responsibility model. | Cloud |
| F-17 | GDPR tools | Data deletion API. PII redaction in traces. Data residency (EU region). | Cloud |
| F-18 | Audit log export | Structured export (JSON, CSV) for compliance audits and SIEM ingestion. | Cloud |
| F-19 | Multi-team cost governance | Per-team monthly budgets. Block tasks when budget exceeded. Finance export. | Cloud |
| F-20 | SLA + uptime | 99% (Starter), 99.5% (Growth), 99.9% (Enterprise). Incident notifications. | Cloud |
| F-21 | Dedicated support | CSM, Slack Connect, quarterly reviews. Enterprise only. | Cloud |
| F-22 | Multi-region data residency | US, EU, APAC region selection. Data never leaves chosen region. | Cloud |
| F-23 | Approval gates | Operator-configured human review before agent commits or auto-merges PR. | Cloud |
| F-24 | Custom model routing | Route tasks to specific model by cost, capability, or compliance requirement. | Cloud |

> **Design principle: OSS is genuinely useful without Cloud.** The OSS version runs a real production agent fleet. It has provenance, kill switches, cost tracking, and a full operator dashboard. It is not crippled. The Cloud features (SSO, RBAC, compliance) are genuinely enterprise requirements — not artificial limits designed to annoy self-hosters.

---

## 4. Phase Roadmap

### Phase 0: Foundation — Weeks 1–8 — Internal MVP

Build the core loop. Private repo. 5 PRs on Harness by Harness. No cloud product yet.

| Features | Status |
|----------|--------|
| Slack entry point → task → PR | Core loop |
| Temporal worker (persistent server, min-instances: 1) | Core infrastructure |
| E2B sandbox, Claude Agent SDK | Core execution |
| Provenance + operator UI + kill switch | Core visibility |
| Verification gates (lint, typecheck, tests) | Core quality |

### Phase 1: OSS Launch — Weeks 8–20 — Public Release — 1,000 Stars

Go public. Docker Compose. CLI TUI. BYOA. GitHub Action. MCP Server. HackerNews launch.

| Features | Tier | Goal |
|----------|------|------|
| Docker Compose local mode | OSS | Zero-friction on-ramp |
| CLI with TUI | OSS | Shareable demo GIF |
| Bring Your Own Agent API | OSS | Works with any existing agent |
| GitHub Action | OSS | Passive distribution in every repo |
| MCP Server | OSS | Anthropic ecosystem distribution |
| AGPL v3 license published | OSS | OSS strategy formalised |
| Harness Cloud waitlist opens | Cloud | Start collecting enterprise interest |

### Phase 2: Cloud Beta — Months 4–9 — Paid Cloud Launch — First Revenue

Launch Harness Cloud as a paid product. Starter and Growth tiers. No SSO yet (that is Enterprise). Build community integrations.

| Features | Tier | Revenue impact |
|----------|------|----------------|
| Harness Cloud Starter ($299/mo) | Cloud | First MRR |
| Harness Cloud Growth ($999/mo) | Cloud | Primary growth vehicle |
| LangGraph + AutoGen adapters | OSS | Python/ML community unlock |
| LangSmith / Langfuse export | OSS | Existing observability teams |
| n8n node | OSS | 50K+ n8n community |
| VS Code extension | OSS | Developer distribution |
| Harness Hub templates (beta) | OSS | Community contributions |
| Cost dashboard (Cloud) | Cloud | CFO answer for spend visibility |
| GKE migration (250 agents) | Cloud | Infrastructure for scale |

### Phase 3: Enterprise Cloud — Months 9–18 — Enterprise GA — $1M ARR

Launch Enterprise tier with SSO, RBAC, and compliance. First enterprise deals. 1,000 concurrent agents. Consider Cloud On-Prem for regulated industries.

| Features | Tier | Revenue impact |
|----------|------|----------------|
| Harness Cloud Enterprise ($4,999/mo) | Cloud | Primary ARR driver |
| SSO — SAML, OIDC, Okta, Google | Cloud (Enterprise only) | Procurement checkbox #1 |
| RBAC + team scoping | Cloud (Enterprise only) | Multi-team enterprise requirement |
| SOC2 Type II report | Cloud (Enterprise only) | Security review checkbox |
| GDPR tools + data residency | Cloud (Enterprise only) | EU enterprise requirement |
| Audit log export (JSON, CSV) | Cloud (Growth+) | Compliance and SIEM teams |
| 99.9% SLA + dedicated CSM | Cloud (Enterprise only) | Tier-1 procurement requirement |
| Approval gates (human-in-loop) | Cloud | Risk management for autonomous agents |
| Multi-team cost governance | Cloud (Enterprise only) | Finance team requirement |
| Cloud On-Prem (VPC deploy) — optional | Cloud Premium | Ford-type enterprise unlock |
| GKE 1000-agent scale | Cloud | Infrastructure milestone |

### Phase 4: Platform — Months 18+ — Self-Sustaining — $5M ARR

| Features | Tier |
|----------|------|
| Harness Hub marketplace with revenue sharing | OSS + Cloud |
| Agent certification programme | OSS |
| Fleet intelligence (ML-optimised routing) | Cloud |
| Plugin API (sandbox, model, observability providers) | OSS |
| Enterprise Fleet Benchmarks (industry data) | Cloud |
| Self-improving agents (prompt refinement from traces) | Cloud |

---

## 5. Revenue Projections

### 5.1 Cloud Revenue Model

All revenue comes from Harness Cloud. No enterprise self-hosted license. No consulting (until Phase 3+).

| Month | Starter teams | Growth teams | Enterprise teams | MRR | ARR run-rate |
|-------|--------------|-------------|-----------------|-----|-------------|
| Month 4 (Cloud beta) | 5 | 0 | 0 | $1,495 | $17,940 |
| Month 6 | 15 | 3 | 0 | $7,482 | $89,784 |
| Month 9 | 30 | 8 | 1 | $17,957 | $215,484 |
| Month 12 | 55 | 18 | 3 | $36,952 | $443,424 |
| Month 15 | 80 | 30 | 6 | $58,967 | $707,604 |
| Month 18 | 100 | 45 | 10 | $83,390 | $1,000,680 |

### 5.2 Path to $1M ARR

At Month 18: 100 Starter + 45 Growth + 10 Enterprise = $83,390 MRR = **$1.0M ARR**

- **Starter ($299)**: High volume, low touch. Acquired via OSS → trial → paid conversion.
- **Growth ($999)**: Core revenue. Engineering teams with 10+ operators. Primary target.
- **Enterprise ($4,999)**: 10 deals drives $600K ARR alone. Requires SSO, RBAC, SOC2.

### 5.3 Unit Economics

| Metric | Starter | Growth | Enterprise |
|--------|---------|--------|------------|
| Monthly revenue | $299 | $999 | $4,999 |
| Cost of goods (infra + support) | ~$130 | ~$300 | ~$800 |
| Gross margin | ~56% | ~70% | ~84% |
| Target CAC | <$500 | <$2,000 | <$10,000 |
| Expected LTV (3yr) | $10,764 | $35,964 | $179,964 |
| LTV:CAC | 21x | 18x | 18x |

---

## 6. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Anthropic / GitHub build fleet management | High | AGPL v3 OSS = open standard they must compete with. On-prem regulated industries unaddressable by cloud-only competitors. |
| Enterprise needs on-prem (Ford) | High | Cloud On-Prem option in Phase 3. Until then, accept limitation and focus on cloud-friendly enterprises. |
| Free OSS users never convert to Cloud | Medium | SSO and RBAC are genuine enterprise requirements, not artificial limits. Teams that grow past 10 operators will need RBAC naturally. |
| Competitors copy OSS and offer cheaper cloud | Medium | AGPL v3 requires them to open source modifications. Enterprise relationships and support quality are not replicable by commodity cloud. |
| Persistent server complexity deters self-hosters | Low | Docker Compose makes local setup trivial. Helm chart makes production setup documented. Harness Cloud removes all infra burden. |

---

## 7. Appendix: Feature Matrix by Phase

| Feature | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Tier |
|---------|---------|---------|---------|---------|---------|------|
| Core agent loop | ✓ | ✓ | ✓ | ✓ | ✓ | OSS |
| Docker Compose | — | ✓ | ✓ | ✓ | ✓ | OSS |
| CLI + TUI | — | ✓ | ✓ | ✓ | ✓ | OSS |
| GitHub Action | — | ✓ | ✓ | ✓ | ✓ | OSS |
| MCP Server | — | ✓ | ✓ | ✓ | ✓ | OSS |
| LangGraph / AutoGen | — | — | ✓ | ✓ | ✓ | OSS |
| YAML pipelines | — | — | ✓ | ✓ | ✓ | OSS |
| Harness Hub | — | — | Beta | ✓ | ✓ | OSS |
| Harness Cloud Starter/Growth | — | — | Beta | ✓ | ✓ | Cloud |
| Harness Cloud Enterprise | — | — | — | ✓ | ✓ | Cloud |
| SSO / SAML / OIDC | — | — | — | ✓ | ✓ | Cloud (Ent) |
| RBAC | — | — | — | ✓ | ✓ | Cloud (Ent) |
| SOC2 | — | — | — | ✓ | ✓ | Cloud (Ent) |
| GDPR / compliance | — | — | — | ✓ | ✓ | Cloud (Ent) |
| Audit log export | — | — | — | ✓ | ✓ | Cloud (Gro+) |
| 1000+ agents | — | — | — | ✓ | ✓ | Cloud |
| Cloud On-Prem | — | — | — | Optional | ✓ | Cloud (Prem) |
| Fleet Intelligence | — | — | — | — | ✓ | Cloud |
