---
name: code-review-typescript
description: TypeScript code review checklist for Spoke PRs. Use when reviewing PRs for quality, security, conventions, and correctness.
---

# Code Review: TypeScript

## Overview

Checklist and guidelines for reviewing TypeScript code in the Spoke monorepo.

## When to Use

- Reviewing a PR before merge
- Security audit of TypeScript code
- Checking conventions compliance
- Evaluating test quality

## Review Checklist

### Type Safety

- [ ] No `any` or `as any` casts without justification
- [ ] Zod schemas used for external input validation
- [ ] Function return types are explicit
- [ ] Generics used correctly (not over-abstracted)
- [ ] No `!` non-null assertions without comments

### Error Handling

- [ ] Async errors are caught or propagated
- [ ] External API calls have timeout handling
- [ ] Database queries handle connection failures
- [ ] Expected errors use Result type or proper error classes

### Security

- [ ] No secrets/hardcoded credentials in source
- [ ] Input from external sources is validated (Zod)
- [ ] SQL queries use parameterized (Prisma) — no string interpolation
- [ ] File paths are sanitized

### Testing

- [ ] New code has unit tests
- [ ] Edge cases are covered (empty, null, timeout)
- [ ] Tests don't depend on external services (mocked)
- [ ] Integration tests for API endpoints

### Conventions

- [ ] Follows monorepo package structure
- [ ] Public API is exported from `src/index.ts`
- [ ] No circular dependencies between packages
- [ ] Imports use package name, not relative paths to siblings

### Performance

- [ ] No blocking operations in request handlers
- [ ] Database queries are indexed or limited
- [ ] No unbatched N+1 queries in loops
- [ ] Large payloads are streamed, not buffered

## Anti-patterns

- ❌ Don't approve without reading the full diff
- ❌ Don't ignore type errors in test files
- ❌ Don't skip review for "small" changes

## Related Skills

- `writing-typescript-module` — Module patterns being reviewed
- `writing-unit-test-typescript` — Test patterns
- `integrating-temporal-workflow` — Workflow code review
