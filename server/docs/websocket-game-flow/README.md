# WebSocket Game Flow (Socket.IO)

This folder documents the **game-flow Socket.IO events** used by the OpenQuester backend, with short notes about **what the frontend should do** and the **edge cases already handled server-side**.

Scope:

- Game flow events (`SocketIOGameEvents.*`) and the most relevant system event (`error`).
- Focused on: lobby → rounds → questions → final round → finish.

Not in scope:

- REST APIs
- Admin panel events

## Quick rules

- Clients authenticate Socket.IO with `POST /v1/auth/socket` and then use the `/games` namespace for game-flow events.
- The lobby-level `games` event uses `GameEventDTO` (`created`, `changed`, `deleted`) and is documented in `../../openapi/schema.json`.
- **One event name can be both directions**: most events are both **client → server** (request) and **server → client** (broadcast).
- **Errors** are sent only to the origin socket via `error` (payload: `{ message: string }`).
- **Per-game action queue**: game-changing events run through a lock+queue per `gameId`, so the backend applies changes sequentially. Queued actions use the same mutation processing path as actions that start immediately.
- **Direct execution**: read-only actions such as `chat-message` bypass the mutation queue but still load game/session context for validation.
- **Role-based data filtering**:
  - `question-data`: showman receives full question; others receive a “simple” question.
  - `next-round` in final round: showman receives full round themes/questions; others receive themes with empty questions.
- **Join snapshots during questions**: joining sockets get `game-data`; during `MEDIA_DOWNLOADING` they get `question-pick` preload, after the gate opens they get role-filtered `question-data`, and during answer reveal they use `gameState.answerShowData`.

## Docs

- [Events reference](events.md)
- [Edge case scenarios](scenarios.md)

## Related docs

- Final round detailed phases: [docs/final-round-flow.md](../final-round-flow.md)
- Action queue internals: [docs/game-action-executor.md](../game-action-executor.md)
- OpenAPI REST/socket contract: [openapi/schema.json](../../../openapi/schema.json)
