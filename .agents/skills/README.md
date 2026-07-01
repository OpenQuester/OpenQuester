# OpenQuester agent skills

Skills are repeatable workflows for Codex-style agents. Use them when the task matches their trigger.

Each skill is a folder with a `SKILL.md` file. `SKILL.md` must start with frontmatter containing `name` and `description` so Codex can discover and trigger it reliably.

## Available skills

| Skill | Use when |
|---|---|
| `backend-socket-action/` | Adding/changing Socket.IO game events, GameAction handlers, queued actions, or public socket contracts. |
| `backend-http-api/` | Changing backend HTTP API work or REST OpenAPI entries. |
| `backend-rules/` | Changing backend game/package/service rules. |
| `backend-redis-cache-change/` | Changing Redis/cache behavior, TTLs, queues, indexes, or cache-backed services. |
| `backend-runtime-event/` | Changing backend timers, scheduled work, Redis expiration handlers, pub/sub, or lifecycle handlers. |
| `backend-maintenance/` | Backend bug fixes, cleanup, extraction, or refactors that should preserve behavior. |
| `frontend-game-ui-state/` | Changing gameplay UI, role-aware CTAs, buzzer UI, timers, media waiting, reconnect, final screens. |
| `package-editor-change/` | Changing package editor, SIQ/OQ import/export, media refs, validation, package health. |
| `openapi-sdk-change/` | Changing REST/Socket.IO public contract or generated Dart SDK. |
| `project-assurance/` | Changing validation strategy, E2E structure, fixtures, helpers, or confidence-building docs. |
| `docs-upkeep/` | Updating docs, specs, skills, AGENTS files, ADRs, or source-of-truth routing. |
| `release-gate-audit/` | Auditing MVP/alpha/beta readiness, stability, load tests, reconnect/media/storage/admin diagnostics. |

## Skill usage rule

Before editing code, read the relevant `SKILL.md` and the scoped `AGENTS.md` for the files being changed.

If a workflow is repeated often and not covered here, add a new skill instead of expanding root `AGENTS.md`.
