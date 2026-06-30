---
name: openapi-sdk-change
description: Use when changing openapi/schema.json, REST contracts, Socket.IO contract metadata, generated Dart API models in client/packages/openapi, or frontend/server code that depends on public contracts.
---

# OpenAPI and SDK change skill

Use this skill when changing `openapi/schema.json`, REST contracts, Socket.IO contract metadata, generated Dart API models, or frontend/server code that depends on the public contract.

## Trigger examples

- “change API response”
- “add REST endpoint”
- “change socket payload”
- “update OpenAPI schema”
- “regenerate Dart SDK”
- “generated model changed”

## Read first

1. `openapi/AGENTS.md`
2. `server/AGENTS.md` for backend-owned contracts
3. `client/AGENTS.md` for generated-client usage
4. `docs/agent/03-verification-matrix.md`

## Files to inspect

Backend:

- relevant REST controller in `server/src/presentation/controllers/rest/**`
- relevant Joi scheme in `server/src/presentation/schemes/**`
- relevant DTOs in `server/src/domain/types/dto/**`
- relevant socket enums/types in `server/src/domain/enums/**` and `server/src/domain/types/socket/**`
- `server/src/presentation/controllers/io/SocketActionMap.ts` for socket events

Contract:

- `openapi/schema.json`
- `client/packages/openapi/swagger_parser.yaml`

Frontend:

- generated models/client package in `client/packages/openapi/`
- affected app controllers/services/listeners
- localization/UI if new user-facing errors/states appear

## Contract invariant

The public contract should not drift between backend, schema, and client.

If backend behavior changes but schema does not, generated clients hallucinate old behavior. If schema changes but backend/client do not, compilation or runtime behavior breaks.

## Implementation steps

1. Identify whether the change is REST, Socket.IO, enum, DTO, or error contract.
2. Update backend code/types/validators first or inspect existing code if schema-only correction.
3. Update `openapi/schema.json`.
4. Run schema validation from `server/`.
5. Regenerate Dart API/models from `client/` when in scope.
6. Update frontend call sites/listeners for new generated shapes.
7. Update docs/specs if product-visible behavior changed.
8. Report compatibility impact.

## Compatibility rule

Prefer additive changes:

- add optional fields before required fields
- add new enum values only when client default/unknown behavior is safe
- keep old event names unless a breaking change is intentional
- document breaking changes explicitly

## Socket.IO contract notes

For game events, keep schema aligned with:

- `SocketIOEvents.ts`
- `GameActionType.ts`
- `SocketActionMap.ts`
- domain socket payload types
- generated Dart event/model usage

If changing a game-changing event, also use `.agents/skills/backend-socket-action/SKILL.md`.

## Common failure modes

- REST controller changed but OpenAPI unchanged.
- Socket event payload changed but `x-socket-io` metadata unchanged.
- OpenAPI updated but generated Dart files not regenerated.
- Generated files manually patched instead of generated.
- Frontend still expects old enum values.
- New server error is not represented in frontend user-facing state.
- Required field added without migration/compatibility decision.

## Verification

From `server/`:

```bash
npm run validate:schema
npm run lint
npm run build
```

From `client/` when generated SDK/client is in scope:

```bash
melos run gen_api
melos run gen_files
melos run analyze
```

If generation is intentionally not run, state why.

## PR summary checklist

Include:

- contract area changed: REST / Socket.IO / enum / DTO / error
- backend files changed
- schema files changed
- generated client impact
- compatibility/breaking-change notes
- verification run
