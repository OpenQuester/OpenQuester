# openapi/AGENTS.md — API contract and generated-client rules

Use this file for changes under `openapi/` or any task that changes a public REST/Socket.IO contract.

## Role of OpenAPI

`openapi/schema.json` is the public contract source for REST endpoints and Socket.IO contract metadata.

The generated Dart client package lives in `client/packages/openapi/`. It is generated from `openapi/schema.json` through `client/packages/openapi/swagger_parser.yaml` and the Melos `gen_api` script.

Contract changes are cross-layer changes. Treat them as backend + schema + generated client + app usage work unless the task explicitly scopes otherwise.

## When to update `schema.json`

Update the schema when any of these change:

- REST endpoint path, method, request body, query params, path params, response body, status code, or auth behavior.
- Public DTO shape used by the client.
- Socket.IO event name, direction, payload, output/broadcast data, auth/session behavior, or namespace metadata.
- Enum values visible to the client.
- Error contract that the client is expected to handle.

Do not update schema for purely internal server classes, private database models, or refactors that do not affect the public contract.

## Generation workflow

Backend validation from `server/`:

```bash
npm run validate:schema
```

Client generation from `client/`:

```bash
melos run gen_api
melos run gen_files
```

Full client pre-build when unsure:

```bash
melos run pre_build
```

If generated files in `client/packages/openapi/` change, include them in the PR unless project maintainers explicitly prefer generation outside the PR.

## Agent workflow

For contract changes, use `.agents/skills/openapi-sdk-change/SKILL.md`.

Minimum sequence:

1. Inspect existing backend endpoint/socket event and DTOs.
2. Update server contract types/validators/use cases if needed.
3. Update `openapi/schema.json`.
4. Regenerate client models if schema generation is in scope.
5. Update frontend call sites/listeners if generated types changed.
6. Run relevant validation.
7. Report contract impact in the PR summary.

## Socket.IO metadata

Socket.IO contract metadata belongs in `x-socket-io` and related schemas. Keep event names aligned with:

- `server/src/domain/enums/SocketIOEvents.ts`
- `server/src/domain/enums/GameActionType.ts` where applicable
- `server/src/presentation/controllers/io/SocketActionMap.ts`
- generated Dart event/model usage in `client/packages/openapi/` and app code

For game-changing socket events, also read:

- `server/AGENTS.md`
- `.agents/skills/backend-socket-action/SKILL.md`
- `docs/specs/game-state-matrix.md`

## Generated files

Generated Dart files in `client/packages/openapi/` should reflect schema/source changes. Do not patch generated Dart output manually as a shortcut. If a file is temporarily manual, preserve the existing comment and call out the exception in the PR.

## Compatibility

Prefer additive changes for public contracts when possible. If a breaking change is required, document:

- old behavior
- new behavior
- affected backend handlers/controllers
- affected client call sites
- migration or release note
- validation performed
