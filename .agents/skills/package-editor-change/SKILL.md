---
name: package-editor-change
description: Use when changing package editor screens/controllers, OQ/SIQ import-export, media references, package validation, compression progress, package health, publish readiness, or creator workflow. Avoid for gameplay-only changes.
---

# Package editor change skill

Use this skill when changing package editor screens/controllers, `.oq` import/export, `.siq` import, media references, package validation, compression progress, package health, or creator workflow.

## Read first

1. `web/AGENTS.md`
2. `docs/product/00-north-star.md`
3. `docs/specs/package-validation-spec.md`
4. `docs/specs/siq-compatibility-matrix.md`
5. `openapi/AGENTS.md` if backend/API contract changes

## Dependency guidance

Follow `web/AGENTS.md` and inspect installed package APIs.

## Files to inspect

See `web/AGENTS.md` and `docs/specs/media-editor.md` for architecture and media behavior.

- `web/src/features/package-editor/` owns drafts, validation and publishing.
- `web/src/features/upload/` owns archive parsing, optimization and upload.
- localization JSON

## Product invariant

The editor should help creators produce playable packages. It is not just a raw form for package JSON.

Every validation/import/export change should answer:

- What did the creator do?
- What changed in the package?
- What is broken or risky?
- Can the creator save a draft?
- Can the creator publish/playtest?
- Where should the creator click next?

## Implementation steps

1. Identify whether change affects editor state, import/export, validation, media, or backend contract.
2. Inspect the existing owning flow (`packageEditorStore`) before adding parallel state.
3. Preserve media reference-by-hash behavior.
4. Preserve compression/encoding progress behavior.
5. For SIQ import, classify compatibility status in `docs/specs/siq-compatibility-matrix.md`.
6. For validation, classify severity in `docs/specs/package-validation-spec.md`.
7. Add localized user-facing messages.
8. Update OpenAPI/generated client if validation/report shape crosses backend/client boundary.
9. Add fixtures/checks where practical.
10. Report import/export/manual validation scenarios.

Keep preview, storage/download, and in-game playback evidence separate. A valid
hash/link or successful preview does not prove that all game clients prepared
media before acknowledging readiness. Use `server/docs/media-download-sync.md`
when an editor/playtest change crosses into gameplay, and preserve unsupported
feature/validation gaps rather than describing product targets as implemented.

## Common failure modes

- Import converts unsupported SIQ data without warning.
- Media file hash map and package file references diverge.
- Package is exportable but not re-importable.
- Compression progress looks like the app froze.
- Validation blocks draft save unnecessarily.
- User-facing validation strings are hard-coded.
- Generated API models are not updated after contract changes.

## Verification

Run the web checks in `docs/agent/03-verification-matrix.md`, including
browser media/storage tests and relevant backend-backed Playwright flows.
If the schema changes, run `npm run gen:api` and `npm run check:api` from `web/`.

From `server/` when backend contract or validation changes:

```bash
npm run validate:schema
npm run lint
npm run build
```

## Handoff checklist

Include the editor/import/export area touched, validation severity changes, SIQ compatibility impact, media/compression impact, API/generated impact, checks/manual scenarios run, and known gaps.
