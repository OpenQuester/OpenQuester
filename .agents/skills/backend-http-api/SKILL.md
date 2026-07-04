---
name: backend-http-api
description: Use when adding or changing backend HTTP API handlers, REST controllers, request/response DTOs, Joi schemes, or OpenAPI REST contract entries.
---

# Backend HTTP API skill

Use this skill when adding or changing HTTP API handlers under `server/src/presentation/controllers/rest/**` or when a public REST contract changes.

## Read first

1. `server/AGENTS.md`
2. `openapi/AGENTS.md` if request or response contract changes
3. `docs/agent/03-verification-matrix.md`
4. Relevant service/domain files for the feature area

## Files to inspect

Likely backend files:

- `server/src/presentation/controllers/rest/**`
- `server/src/presentation/schemes/**`
- `server/src/presentation/middleware/**`
- `server/src/application/services/**` or relevant use case
- `server/src/domain/types/dto/**`
- `server/src/domain/validators/**`
- `server/src/domain/enums/HttpStatus.ts`
- `openapi/schema.json`

## Architecture invariant

REST controllers adapt transport input and delegate work. They should not own business logic.

Expected flow:

```text
Express Router -> asyncHandler -> RequestDataValidator/Joi -> application service/use case -> domain rules -> DTO response
```

## Implementation steps

1. Find the closest existing controller pattern.
2. Add or update Joi validation in `presentation/schemes/**`.
3. Add or update public DTOs in `domain/types/dto/**` when needed.
4. Keep business logic in application/domain.
5. Use `asyncHandler` for async handlers.
6. Use `RequestDataValidator` for body, query, and params.
7. Use `HttpStatus` for status codes where practical.
8. Keep request guards consistent with nearby code.
9. Update `openapi/schema.json` for public contract changes.
10. Regenerate generated Dart client when schema changes are in scope.
11. Add focused tests when behavior is non-trivial.

## Common failure modes

- Controller contains business logic instead of delegating.
- Joi scheme and OpenAPI schema diverge.
- Query params are used without validation.
- Response shape changes without generated client consideration.
- Controller imports infrastructure directly.
- Errors bypass existing middleware.

## Verification

From `server/`:

```bash
npm run validate:schema
npm run lint
npm run build
```

If generated client changes, from `client/`:

```bash
melos run gen_api
melos run gen_files
melos run analyze
```

## Handoff checklist

Report HTTP method/path changes, validation changes, guard behavior, application/domain files touched, OpenAPI/generated-client impact, and checks run or skipped.
