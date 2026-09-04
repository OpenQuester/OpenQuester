# ADR 0004: React Web alongside Flutter Native

## Status

Accepted.

## Context

OpenQuester needs a browser-first experience with responsive navigation, accessible web primitives, reliable keyboard buzzer input, a worker-backed package editor, and web-native OAuth. Flutter remains valuable for native releases, but coupling the hosted website to the native build made browser concerns difficult to evolve independently.

## Decision

The hosted client is a strict TypeScript React application in `client-web/`, built with Vite. It consumes `openapi/schema.json`, authenticates with the same credentialed session cookie, and connects to the existing `/games` Socket.IO namespace. Authoritative game state remains server-owned and is rebuilt from a join snapshot plus typed events.

Flutter remains the native Android, Windows, and Linux client. Existing token-based Discord authentication stays available for Flutter. Only the Cloudflare Pages artifact changes from Flutter Web output to `client-web/dist`.

## Consequences

- OpenAPI is shared by both clients, and generated TypeScript drift is a CI failure.
- Node 24 is used for browser-client development and CI; the server runtime is unchanged.
- Browser-only OAuth, draft editing, Web Workers, and SPA routing can evolve without changing native release jobs.
- Shared behavior must agree with the game-state and buzzer specifications; platform view code is not a second source of game truth.
- Rollback is artifact-based: retain the previous successful Flutter Web artifact until the React preview passes end-to-end, accessibility, and visual checks.
