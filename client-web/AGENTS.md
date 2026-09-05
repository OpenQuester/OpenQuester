# client-web/AGENTS.md — React web client source of truth

`client-web` is the production browser client. Flutter under `client/` remains the source for native applications; shared behavior and wire contracts come from `openapi/schema.json` and the product/game specs.

## Architecture

- `src/app/` owns providers, routing, and the responsive shell.
- `src/features/` owns auth, games, lobby/gameplay, packages, editor, and settings.
- `src/shared/api/` owns generated REST types and credentialed transport.
- `src/shared/realtime/` owns Socket.IO lifecycle and event reduction.
- `src/shared/ui/` owns reusable accessible primitives.
- `src/i18n/` owns all user-facing strings.

REST cache belongs to TanStack Query. Authoritative game state belongs to the realtime Zustand store. Editor state belongs to the editor Zustand store. Do not mirror either store in component-local state.

## Rules

- Keep TypeScript strict and avoid `any`.
- Generate `src/shared/api/schema.d.ts` and `src/shared/realtime/socket.generated.ts` from `openapi/schema.json`; never hand-edit either file.
- Take REST and socket types from those generated files. Do not re-declare a
  DTO by hand: the hand-written copies drifted and the game list spent a
  release reading fields the API never sent.
- Subscribe to socket events from `GENERATED_SERVER_SOCKET_EVENTS`, never a
  hand-maintained list.
- Every gameplay phase/role must expose current state, primary action, disabled reason, timer/wait, and feedback.
- Never imply a buzzer win before server confirmation.
- Keep socket listeners centralized and remove them on teardown.
- Localize every user-facing string, and add the key to every locale in the
  same change; `npm run check:locales` enforces parity.
- Colour that carries text comes from `--accent`; solid brand fills use
  `--accent-fill`. Both themes need their own values.
- Preserve media hash references and never silently degrade imported SIQ features.
- Use source assets or Lucide icons; do not draw replacement icons in CSS/SVG.

## Verification

Run `npm run generate:api`, `npm run check:locales`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Use `npm run test:e2e` when the backend test stack is available.
