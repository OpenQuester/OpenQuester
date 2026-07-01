# SIQ compatibility matrix

This spec defines how OpenQuester should handle SIGame `.siq` import compatibility. It is both a product spec and an agent guardrail.

Status note: this is a target compatibility matrix and audit baseline, not a claim that every status is already implemented. Verify current parser/editor/game code before marking a SIQ feature as done.

## Product rule

Never silently corrupt a legacy package.

If OpenQuester cannot fully preserve a SIQ feature, the import flow should say so clearly and give the creator a next action.

## Compatibility statuses

| Status | Meaning | User-facing behavior |
|---|---|---|
| `Supported` | Feature imports and plays as expected. | No warning required, optional success summary. |
| `SupportedWithConversion` | Feature imports but is normalized or represented differently. | Warning/info with what changed. |
| `Partial` | Important data is preserved but gameplay/editor behavior is incomplete. | Warning, link to affected questions, package not fully clean. |
| `UnsupportedWithFallback` | Feature cannot be represented exactly but a safe fallback exists. | Warning, show fallback behavior, require review. |
| `UnsupportedCritical` | Feature cannot be safely imported or played. | Critical error; block publish/play until fixed. |
| `Unknown` | Parser encountered data not classified yet. | Warning or critical depending on risk; add to unsupported accumulator. |

## Import report requirements

Every SIQ import should eventually produce a compatibility report with:

- total rounds/themes/questions imported
- media files imported
- supported features count
- warnings count
- critical errors count
- unsupported/unknown features list
- links/jumps to affected questions
- suggested next action

The report should distinguish:

- “converted successfully”
- “converted with changes”
- “not supported, fallback used”
- “not supported, manual fix required”
- “parser unknown, needs audit”

## Initial feature matrix

This matrix should be updated as parser/editor/game support evolves.

| SIQ feature | Target status | Expected behavior |
|---|---|---|
| Package metadata/title | Supported | Import into package info. |
| Package description | Supported | Import into package description when available. |
| Rounds/themes/questions | Supported | Preserve order and basic structure. |
| Text question | Supported | Import question text and answer. |
| Image/audio/video media | SupportedWithConversion | Import media by hash and represent through OQ media fields; warn if file type/codec is risky. |
| Simple answer text | Supported | Preserve answer text. |
| Answer media | Partial | Preserve when model supports it; warn if game/editor preview is incomplete. |
| Choice question | Partial | Preserve choices when possible; ensure gameplay CTA explains screen selection. |
| Stake/bidding question | Supported or Partial | Preserve type if game support exists; warn if SIQ semantics differ. |
| Secret/transfer question | Supported or Partial | Preserve transfer behavior if game support exists; warn on unsupported variants. |
| No Risk question | Supported | Preserve no-negative-score behavior. |
| Hidden/unknown price modes | Partial or UnsupportedWithFallback | Use safe fallback and warn; do not silently change strategy. |
| Final round | Partial | Preserve themes/questions; warn on unsupported final-specific metadata. |
| Authors/sources/comments | Partial | Preserve where target model supports; otherwise info warning. |
| Complex scenario/scripted behavior | UnsupportedCritical | Block publish until manually resolved or removed. |
| Unsupported media reference | UnsupportedCritical | Critical validation error. |
| Unknown XML node/attribute with gameplay impact | Unknown | Add to unsupported feature accumulator. |

## Unsupported feature accumulator

The importer should accumulate unsupported/unknown features with enough context for the editor to show them.

Recommended shape conceptually:

```text
featureId
severity: info | warning | critical
sourcePath: round/theme/question/media path
messageKey
rawFeatureName
fallbackBehavior
requiresManualReview
```

Do not store raw giant XML blobs in user-facing state. Keep enough context for debugging and report generation.

## Editor behavior after import

After SIQ import:

1. Show the compatibility report before implying the package is ready.
2. Let creator jump to the next problem.
3. Mark package health: good / needs attention / broken.
4. Block publish/playtest only for critical errors.
5. Allow export/save of drafts with warnings if data is preserved.

## Backend/client contract

If the import report becomes part of backend API or saved package metadata, update:

- `openapi/schema.json`
- generated Dart client/models in `client/packages/openapi/`
- package editor UI
- package validation spec if it changes publish readiness

## Agent workflow

When changing SIQ import:

1. Inspect `client/packages/siq_file/` parser behavior.
2. Inspect `client/packages/oq_editor/lib/utils/siq_import_helper.dart` conversion behavior.
3. Decide compatibility status for the changed feature.
4. Update this matrix.
5. Add/adjust report or validation behavior if user-facing risk changes.
6. Add tests/fixtures where practical.
7. Report whether generated files or OpenAPI were affected.

## Done when

A SIQ compatibility change is not done until unsupported or lossy behavior is visible to the creator. Silent degradation is a bug.
