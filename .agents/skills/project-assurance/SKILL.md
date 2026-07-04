---
name: project-assurance
description: Use when changing validation strategy, automated checks, E2E structure, integration coverage, fixtures, helpers, CI validation, or quality documentation.
---

# Project assurance skill

Use this skill for changes to validation or confidence-building structure, especially when the user asks for a stronger E2E or integration setup rather than a single small check.

## Read first

1. `docs/agent/03-verification-matrix.md`
2. `server/AGENTS.md` for backend behavior
3. `client/AGENTS.md` for frontend behavior
4. Relevant product/spec docs for the behavior under validation

## Planning rule

For broad validation work, do not start by moving files. First map:

- what behavior needs confidence
- current layers and helpers
- gaps and flaky areas
- fixtures/helpers that should be shared
- what belongs in unit, integration, or E2E coverage
- required local/CI infrastructure
- how commands should run

## Backend rules

- Prefer focused checks around domain rules and use cases.
- Socket/game behavior should cover role, phase, invalid payload, and queue-sensitive cases.
- Timer checks must not use `setTimeout`; use `TestUtils.expireTimer()` or direct helpers.
- PostgreSQL/Redis-dependent checks should be clearly documented.

## Frontend rules

- Use widget/controller checks where they add real confidence.
- Gameplay UI coverage should include phase, role, primary CTA, and disabled reason.
- Generated models should be regenerated from source, not patched.
- For Flutter/package API uncertainty, use Context7 before choosing new APIs or packages.

## E2E/refactor workflow

1. Inventory current checks and helpers.
2. Define target validation pyramid for the feature area.
3. Create a small migration plan before moving many files.
4. Keep fixtures readable and close to the behavior they represent.
5. Avoid making E2E the only coverage for business rules.
6. Add docs for how to run the new layer.
7. Update verification matrix if command structure changes.

## Common failure modes

- Large reorg with no behavior map.
- E2E duplicates lower-level checks but misses user-critical flows.
- Flaky waits instead of deterministic hooks.
- Hidden infrastructure requirements.
- Current time, random order, or network timing is uncontrolled.
- Docs still tell agents to run old commands.

## Handoff checklist

Report validation layer changed, commands added/changed, fixtures/helpers added, coverage gaps still open, flaky-risk mitigations, and docs updated.
