# GitHub Copilot instructions for OpenQuester

This file is intentionally short. The canonical agent documentation is in repo docs, not in `.github` prompts.

## Read first

- `AGENTS.md` — repository-wide agent router.
- `server/AGENTS.md` — backend architecture and rules.
- `client/AGENTS.md` — Flutter/Melos/frontend rules.
- `openapi/AGENTS.md` — schema, public contract, and generated-client workflow rules.
- `docs/product/00-north-star.md` — product direction.
- `docs/agent/03-verification-matrix.md` — checks by task type.

## Core behavior

- Make the smallest safe change that solves the task.
- Preserve existing architecture unless the task explicitly asks to change it.
- Prefer current code and scoped `AGENTS.md` files over stale snippets.
- Call out uncertainty and documentation drift instead of guessing.
- Do not make formatting-only or unrelated changes.

## Product lens

OpenQuester is a multiplayer quiz platform inspired by SIGame. Its advantage should be clarity, speed, stability, and creator-friendly package workflows. For gameplay UI, role-aware CTAs, disabled reasons, timers, and result feedback are part of the feature, not optional polish.

## Safety rules

- Backend game-changing socket actions go through `GameActionExecutor`.
- Application use cases return declared mutations; they do not directly emit Socket.IO events.
- Frontend changes use generated models/localization patterns unless the scoped docs say otherwise.
- Public API/socket contract changes require OpenAPI/schema and generated-client consideration.

## Reviews

When reviewing code, check architecture boundaries, race conditions, public contract drift, security, maintainability, UX clarity, and missing validation/tests.
