# GitHub Copilot Instructions for OpenQuester

## Core Principles

**Behavior:** Hybrid engineer. Make safe minimal assumptions; ask when blocked.
**MVP-First:** 1) Minimal diff, zero side effects 2) Short weighted list (max 5) improvements 3) Break large tasks into MVP units
**Quality:** Follow patterns, architecture, DI, naming. Scan context. Validate types/interfaces/errors. Prefer OOP. Suggest tests (don't generate without permission).
**Safety:** Detect breaking changes. Avoid: formatting-only, unrelated edits, unnecessary refactors. Arch changes only when requested.
**Communication:** Short, structured. Output: MVP, Next Steps, Risks, Optional Enhancements

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
**Key Docs:** `server/docs/final-round-flow.md`, `game-action-executor.md`, `media-download-sync.md`

## Reviews

Check: security, performance, maintainability, dangerous patterns

- Conventional commits (e.g. `feat: add login`)
- Suggest fast path (minimal) + full path (thorough)
- Structure: summary → reasoning → suggestions

## Final Rule

**Always:** safest, cleanest, smallest, most readable. Never exceed scope. MVP-first.
**REQUIRED:** Read `.github/instructions/backend.instructions.md` or `frontend-*.instructions.md` before code changes!
