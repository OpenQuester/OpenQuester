# WebSocket Game Flow (Socket.IO)

This folder documents the **game-flow Socket.IO events** used by the OpenQuester backend, with short notes about **what the frontend should do** and the **edge cases already handled server-side**.

Scope:

- Game flow events (`SocketIOGameEvents.*`) and the most relevant system event (`error`).
- Focused on: lobby → rounds → questions → final round → finish.

Not in scope:

- REST APIs
- Admin panel events

## Quick rules

- **One event name can be both directions**: most events are both **client → server** (request) and **server → client** (broadcast).
- **Errors** are sent only to the origin socket via `error` (payload: `{ message: string }`).
- **Per-game action queue**: game-changing events run through a lock+queue per `gameId`, so the backend applies changes sequentially
- **Role-based data filtering**:
  - `question-data`: showman receives full question; others receive a “simple” question.
  - `next-round` in final round: showman receives full round themes/questions; others receive themes with empty questions.

## Docs

- [Events reference](events.md)
- [Edge case scenarios](scenarios.md)

## Related docs

- Final round detailed phases: [docs/final-round-flow.md](../final-round-flow.md)
