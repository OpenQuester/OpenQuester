# Documentation drift policy

Documentation drift is a product risk for agentic coding. Agents follow written instructions aggressively; stale docs cause wrong architecture, wrong generated-code behavior, and bad frontend UX.

## Definition

A doc is drifting when it says something that is no longer true about the current repository, product decision, workflow, command, file path, or architecture.

Examples:

- Mentions a removed class or file as current architecture.
- Describes old socket handler registration while current code uses `SocketActionDispatcher` + `SocketActionMap`.
- Tells agents to manually edit generated files.
- Lists a command that no longer exists.
- Describes UX behavior that contradicts the product/state matrix.
- Duplicates another doc and one copy changes while the other does not.

## Fix priority

Fix drift immediately when it affects:

1. Architecture boundaries.
2. Game state, timers, queue/lock, scoring, or realtime fairness.
3. Public API/socket contracts.
4. Frontend generated code/localization workflow.
5. Product North Star, release priority, or MVP gate.
6. Security, permissions, moderation, or admin diagnostics.

Low-risk wording drift can be fixed opportunistically, but should not accumulate.

## Agent rule

When a task reveals drift:

1. Verify with current code.
2. Update the stale doc if it is within task scope.
3. Prefer replacing duplicated details with a pointer to the canonical doc.
4. Mention the drift fix in the PR summary.
5. If not fixed, record the specific stale file and reason.

## How to prevent drift

- Keep root `AGENTS.md` short and route to scoped docs.
- Put repeated workflows into `.agents/skills/*/SKILL.md`.
- Keep product decisions in `docs/product/` and implementation behavior in `docs/specs/`.
- Keep architecture reasons in ADRs, not scattered comments.
- Do not duplicate long command lists across many files.
- Keep `.github/instructions/*` as compatibility pointers, not canonical sources.

## Review checklist

When reviewing docs changes, ask:

- Is there exactly one canonical source for this topic?
- Are all referenced paths real or intentionally planned?
- Does this doc describe current code, not desired future code, unless clearly marked as roadmap/spec?
- Does this doc help an agent choose files, preserve invariants, and verify work?
- Does the doc reduce hallucination risk, especially in frontend/generated-code workflows?

## Deleting vs preserving docs

Delete or collapse docs when they are:

- mostly stale
- duplicating a better canonical doc
- too broad to be actionable
- likely to mislead agents

Preserve docs when they are:

- detailed implementation references
- historically useful ADRs
- feature specs with current behavior
- deep guides linked from skills

If preserving an older deep guide, add a short header or link from the relevant skill to clarify how it should be used.
