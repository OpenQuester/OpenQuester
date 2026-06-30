# Source of truth policy

This document prevents agent hallucinations caused by conflicting instructions.

## Priority order

When sources disagree, use this order:

1. Current code and tests in the target branch.
2. Nearest scoped `AGENTS.md` for the edited path.
3. Relevant spec in `docs/specs/`.
4. Relevant ADR in `docs/architecture/adr/`.
5. Deep implementation docs such as `server/docs/*`.
6. `.github/instructions/*` compatibility reminders.
7. Old comments, old PR descriptions, or stale snippets.

Do not silently choose the convenient source. If the difference matters, update the stale doc or call it out.

## Canonical docs by topic

| Topic | Canonical source |
|---|---|
| Agent routing | `AGENTS.md` |
| Backend architecture | `server/AGENTS.md` + `docs/architecture/adr/` |
| Frontend architecture | `client/AGENTS.md` |
| Public API/schema | `openapi/AGENTS.md` + `openapi/schema.json` |
| Product North Star | `docs/product/00-north-star.md` |
| Release priority | `docs/product/01-release-plan.md` |
| Game phase/role behavior | `docs/specs/game-state-matrix.md` |
| Buzzer behavior | `docs/specs/buzzer-state-machine.md` |
| SIQ import compatibility | `docs/specs/siq-compatibility-matrix.md` |
| Package publish readiness | `docs/specs/package-validation-spec.md` |
| Socket action workflow | `.agents/skills/backend-socket-action/SKILL.md` |
| Frontend game UI workflow | `.agents/skills/frontend-game-ui-state/SKILL.md` |
| Package editor workflow | `.agents/skills/package-editor-change/SKILL.md` |

## What to do with stale docs

If a doc points to a nonexistent file, old class, old flow, or old command:

1. Verify current code.
2. Update the doc in the same PR if it is in scope.
3. Prefer a short pointer to the canonical doc over duplicating a long explanation.
4. Mention the drift fix in the PR summary.

If the stale doc is outside the task scope, leave a clear note in the PR summary so it can be fixed intentionally.

## What not to do

- Do not copy old instructions into new docs without verifying them against code.
- Do not create parallel sources of truth for the same workflow.
- Do not preserve a wrong instruction because it is in `.github/instructions`.
- Do not add a new spec without linking it from `AGENTS.md`, scoped `AGENTS.md`, or a relevant skill.

## Documentation style

Good agent docs are practical:

- clear trigger: when to read/use it
- files to inspect
- safe edit sequence
- invariants to preserve
- tests/checks to run
- common failure modes

Bad agent docs are vague:

- inspirational but not actionable
- duplicate another file
- list every possible detail without priority
- describe old architecture
- omit verification
