# GitHub Copilot Instructions for OpenQuester

## Core Principles

**Scope:** Make the smallest correct change and keep unrelated subprojects untouched.
**Quality:** Follow current patterns, architecture, DI, naming, and generated-file boundaries. Add or update focused tests when behavior changes and an established test pattern exists.
**Safety:** Detect breaking changes. Avoid: formatting-only, unrelated edits, unnecessary refactors. Arch changes only when requested.
**Verification:** Run the smallest relevant checks first and report exact results.

## Project

**OpenQuester** - Multiplayer quiz game (backend: `server/`, frontend: `client/`)

- **Backend:** TypeScript, Node.js, Express, PostgreSQL, Socket.IO, Joi, Redis
- **Frontend:** Flutter, Dart
- **Traffic:** ≥100K MAU | **Tests:** Client requests + DB/Redis validation

### Game Mechanics

**Roles:** Showman (controls flow, marks attempts), Players (compete), Spectators (watch)
**Regular Round:** Pick theme/question → media sync → timer → buzz to answer → showman marks (correct: +price, wrong: -price unless "No Risk")
**Special:** Stake/Bidding, Secret/Transfer, No Risk
**Final Round:** Theme Elimination → Bidding (45s) → Answering (75s, 255 chars) → Reviewing
**Packages:** Community content (`.oq` + `.siq`)
**Key Docs:** `server/docs/final-round-flow.md`, `server/docs/game-action-executor.md`, `server/docs/media-download-sync.md`

## Reviews

Check: security, performance, maintainability, dangerous patterns

- Conventional commits (e.g. `feat: add login`)
- Suggest fast path (minimal) + full path (thorough)
- Structure: summary → reasoning → suggestions

## Scoped instructions

Read the repository `AGENTS.md` first. For backend changes, also follow `server/AGENTS.md`; for frontend changes, follow `client/AGENTS.md` and the matching `.github/instructions/frontend-*.instructions.md` files.
