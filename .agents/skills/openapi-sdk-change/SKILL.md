---
name: openapi-sdk-change
description: Use when changing openapi/schema.json, REST contracts, Socket.IO contract metadata, generated browser REST declarations, or frontend/server code that depends on public contracts.
---

# OpenAPI and SDK change skill

Use this skill when changing `openapi/schema.json`, REST contracts, Socket.IO contract metadata, generated REST declarations, or frontend/server code that depends on the public contract.

## Read first

1. `openapi/AGENTS.md`
2. `server/AGENTS.md` for backend-owned contracts
3. `web/AGENTS.md` for REST and socket usage
4. `docs/agent/03-verification-matrix.md`

## Files to inspect

- backend REST/socket handler files involved in the contract
- backend DTOs and validators involved in the contract
- `openapi/schema.json`
- generated REST declarations in `web/src/api/schema.d.ts`
- separately maintained socket types in `web/src/game/protocol.ts`
- affected app controllers/services/listeners

## Contract invariant

The public contract should not drift between backend, schema, and client.

Separate wire shape, event semantics, and UI behavior. Schema descriptions must
not claim real downloads or synchronized content visibility just because the
backend accepted readiness ACKs. Inspect the actual branch and emitters/listeners;
an unmerged fix or a target spec is not the current protocol.

## Implementation steps

1. Identify whether the change is REST, Socket.IO, enum, DTO, or error contract.
2. Update backend code/types/validators first or inspect existing code if schema-only correction.
3. Update `openapi/schema.json`.
4. Run schema validation from `server/`.
5. Regenerate REST declarations from `web/` when the schema changes and update the socket protocol types separately as needed.
6. Update frontend call sites/listeners for new generated shapes.
7. Update docs/specs if product-visible behavior changed.
8. Report compatibility impact.

For documentation-only corrections to descriptions or `x-socket-io` metadata,
preserve event names, DTO shapes, requiredness, and nullability unless a concrete
mismatch was verified. State whether generation changes runtime types or only
comments/metadata, and report if generation was not run; never hand-edit generated
comments to mimic a generator run. Schema validation checks schema structure,
not compatibility with handlers, event order, or browser behavior.

For media metadata, follow `server/docs/media-download-sync.md`: distinguish
initial question data/media timer, partial status with a null timer, completion
with a question timer, and system timeout readiness. Document wrong-phase ACK
no-ops and no-file client ACKs without introducing a new preload/reveal event.

## Common failure modes

- Backend contract changed but OpenAPI unchanged.
- OpenAPI updated but REST declarations not regenerated.
- Generated files manually patched instead of generated.
- Frontend still expects old enum values.
- Required field added without compatibility decision.

## Verification

From `server/`:

```bash
npm run validate:schema
npm run lint
npm run build
```

From `web/` when the schema changes:

```bash
npm run gen:api
npm run check:api
npm run typecheck
```

## Handoff checklist

Include contract area changed, backend files changed, schema files changed, generated client impact, compatibility notes, and verification run.
