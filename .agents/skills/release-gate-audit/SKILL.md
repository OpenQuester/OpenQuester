---
name: release-gate-audit
description: Use when auditing MVP, alpha, beta, or release readiness; stability gaps; load testing; reconnect/media/storage safety; admin diagnostics; rate-limit UX; or evidence-backed blocker lists.
---

# Release gate audit skill

Use this skill when auditing release readiness, alpha/beta blockers, stability gaps, load testing, reconnect/media/storage safety, or admin diagnostics.

## Trigger examples

- “release readiness”
- “alpha blockers”
- “stability audit”
- “load test report”
- “reconnect matrix”
- “admin diagnostics”
- “storage cleanup”
- “rate limit UX”

## Read first

1. `docs/product/01-release-plan.md`
2. `docs/product/00-north-star.md`
3. `docs/agent/03-verification-matrix.md`
4. `server/AGENTS.md` for backend stability work
5. `client/AGENTS.md` for UX/reporting work

## Audit areas

### Gameplay clarity

- phase indicator
- role-aware primary CTA
- disabled reasons
- timer visibility
- buzzer state machine
- final round clarity
- game end summary

### Realtime stability

- queued action execution
- Redis lock/queue behavior
- timer expiration behavior
- reconnect snapshots
- disconnect during answer/final/review
- media readiness fallback/timeout
- duplicate/double-click safety

### Package/editor safety

- SIQ compatibility report
- unsupported feature accumulator
- package validation engine
- package health badge
- media preview
- compression progress
- storage/upload preflight

### Infra/admin

- load-test report
- admin game diagnostics: state/timer/queue/sockets
- log filtering by game/user/correlation
- in-game bug report with gameId/session/client version
- S3/object storage cleanup
- rate limits with localized UX feedback
- error IDs and user-facing retry/copy flows

## Output format

Use this shape for audit reports:

```markdown
## Summary

One paragraph with release risk level.

## Findings

| Area | Status | Evidence | Risk | Suggested next step |
|---|---|---|---|---|

## P0 blockers

- ...

## P1 before beta

- ...

## Not MVP

- ...

## Verification

- checks run
- checks not run and why
```

## Status vocabulary

Use consistent statuses:

- `Done` — product behavior is implemented and verified at the claimed boundary.
- `Partial` — technical base exists but product definition is incomplete.
- `NotFound` — no implementation evidence found.
- `Polish` — base behavior exists but quality/clarity needs improvement.
- `Blocked` — dependency required first.

## Evidence rule

Every finding should cite file paths or docs. Avoid vague claims like “probably implemented”. If unsure, say what was inspected and what was not found.

Distinguish static inspection, controlled self-tests, real backend transport,
and client/manual evidence. Record the commit and actual test-step result;
a green build or a skipped test step is not a passing gameplay test. In
particular, media readiness ACKs are not evidence of downloaded bytes or hidden
content. Check the known client gaps in `server/docs/media-download-sync.md`.
Treat this audit as read-only unless the user also authorizes implementation.

## Common failure modes

- Treating technical implementation as product-ready when UI does not explain it.
- Marking package import as ready without unsupported-feature reporting.
- Ignoring reconnect/media edge cases because happy path works.
- Treating loadtest tool existence as a load-test report.
- Forgetting client-facing feedback for backend safety features such as rate limits.

## Done when

A release audit is done when it gives maintainers a prioritized, evidence-backed list of blockers and non-blockers without mixing MVP essentials with later roadmap bets.
