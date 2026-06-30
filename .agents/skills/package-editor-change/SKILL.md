---
name: package-editor-change
description: Use when changing package editor screens/controllers, OQ/SIQ import-export, media references, package validation, compression progress, package health, publish readiness, or creator workflow. Avoid for gameplay-only changes.
---

# Package editor change skill

Use this skill when changing package editor screens/controllers, `.oq` import/export, `.siq` import, media references, package validation, compression progress, package health, or creator workflow.

## Trigger examples

- “package editor”
- “SIQ import”
- “OQ export”
- “package validation”
- “media preview”
- “compression progress”
- “publish readiness”
- “package health badge”

## Read first

1. `client/AGENTS.md`
2. `docs/product/00-north-star.md`
3. `docs/specs/package-validation-spec.md`
4. `docs/specs/siq-compatibility-matrix.md`
5. `openapi/AGENTS.md` if backend/API contract changes

## Files to inspect

Likely frontend/package files:

- `client/packages/oq_editor/lib/controllers/oq_editor_controller.dart`
- `client/packages/oq_editor/lib/utils/siq_import_helper.dart`
- `client/packages/oq_editor/lib/utils/oq_package_archiver.dart`
- `client/packages/oq_editor/lib/utils/media_file_encoder.dart`
- `client/packages/oq_editor/lib/models/**`
- `client/packages/oq_editor/lib/view/**`
- `client/packages/siq_file/lib/**`
- `client/packages/oq_compress/lib/**`
- `client/apps/client/lib/src/features/package_editor/**`
- `client/apps/client/lib/src/features/package_upload/**`
- localization JSON

Backend/API if package persistence or validation contract changes:

- `server/src/application/services/package/**`
- package REST controller/schemes
- package DTOs/OpenAPI schema

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
2. Inspect existing `OqEditorController` flow before adding parallel state.
3. Preserve media reference-by-hash behavior.
4. Preserve compression/encoding progress behavior.
5. For SIQ import, classify compatibility status in `docs/specs/siq-compatibility-matrix.md`.
6. For validation, classify severity in `docs/specs/package-validation-spec.md`.
7. Add localized user-facing messages.
8. Update OpenAPI/generated client if validation/report shape crosses backend/client boundary.
9. Add fixtures/tests where practical.
10. Report import/export/manual validation scenarios.

## Validation severity rule

Use:

- `Critical` for package cannot safely play/publish.
- `Warning` for playable but risky/changed/needs review.
- `Info` for helpful quality suggestions.

Do not block draft save for warnings. Block publish/play only for critical errors.

## SIQ import rule

Never silently degrade imported SIQ behavior. If feature support is partial, fallback, unsupported, or unknown, the creator should see it in the compatibility report or validation issues.

## Common failure modes

- Import converts unsupported SIQ data without warning.
- Media file hash map and package file references diverge.
- Package is exportable but not re-importable.
- Compression progress looks like the app froze.
- Validation blocks draft save unnecessarily.
- User-facing validation strings are hard-coded.
- Backend rejects a package after frontend said it was publish-ready.
- Generated API models are not updated after contract changes.

## Verification

From `client/`:

```bash
melos run analyze
```

When generated files/import models/localization change:

```bash
melos run gen_files
melos run gen_locale
melos run pre_build
```

When OpenAPI changes:

```bash
melos run gen_api
```

From `server/` when backend contract or validation changes:

```bash
npm run validate:schema
npm run lint
npm run build
```

Manual scenario notes are useful:

- import `.siq`
- import `.oq`
- add media
- export package
- save/publish validation
- jump to next issue

## PR summary checklist

Include:

- editor/import/export area touched
- validation severity changes
- SIQ compatibility impact
- media/compression impact
- API/generated impact
- checks/manual scenarios run
- known gaps or follow-up
