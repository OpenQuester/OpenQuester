# OpenQuester agent skills

Skills are repeatable workflows for Codex-style agents. Use them when the task matches their trigger.

Each skill is a folder with a `SKILL.md` file. `SKILL.md` must start with frontmatter containing `name` and `description` so Codex can discover and trigger it reliably.

## Available skills

| Skill | Use when |
|---|---|
| `backend-socket-action/` | Adding/changing Socket.IO game events, GameAction handlers, queued actions, or public socket contracts. |
| `frontend-game-ui-state/` | Changing gameplay UI, role-aware CTAs, buzzer UI, timers, media waiting, reconnect, final screens. |
| `package-editor-change/` | Changing package editor, SIQ/OQ import/export, media refs, validation, package health. |
| `openapi-sdk-change/` | Changing REST/Socket.IO public contract or generated Dart SDK. |
| `release-gate-audit/` | Auditing MVP/alpha/beta readiness, stability, load tests, reconnect/media/storage/admin diagnostics. |

## Skill usage rule

Before editing code, read the relevant `SKILL.md` and the scoped `AGENTS.md` for the files being changed.

If a workflow is repeated often and not covered here, add a new skill instead of expanding root `AGENTS.md`.
