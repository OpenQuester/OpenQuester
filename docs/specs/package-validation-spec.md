# Package validation and publish-readiness spec

This spec defines how package/editor validation should behave. Use it when changing package editor fields, `.oq`/`.siq` import, media upload, package publish, package health, or package discovery metadata.

Status note: this is a target validation spec, not a claim that every validation rule or health state is implemented today. Verify current editor/backend code before marking a rule as done.

## Product rule

Broken packages destroy trust. The editor should help creators fix packages before players experience failures.

Validation should be visible, actionable, and grouped by severity.

## Severity levels

| Severity | Meaning | Behavior |
|---|---|---|
| `Critical` | Package cannot be safely played or published. | Block publish/play until fixed. |
| `Warning` | Package can be played but quality, compatibility, or cost/user experience is risky. | Allow draft/save; show warning before publish. |
| `Info` | Helpful improvement or metadata suggestion. | Do not block. |

## Package health states

| Health | Meaning | Suggested UI |
|---|---|---|
| `Good` | No critical errors; few or no warnings. | Green/positive badge. |
| `NeedsAttention` | No critical errors, but meaningful warnings exist. | Yellow warning badge and “review issues”. |
| `Broken` | At least one critical error exists. | Red badge; publish/play blocked. |
| `Unknown` | Validation did not run or failed. | Neutral badge; request validation. |

## Critical validations

A package should be considered broken when any of these are true:

- package has no title
- package has no rounds
- round has no themes
- theme has no questions
- question has neither text nor media
- answer has neither text nor answer media where answer is required
- media reference is missing/broken
- media file type is not allowed
- package contains unsupported SIQ feature without safe fallback
- final round lacks enough valid themes/questions for current gameplay rules
- package exceeds hard storage/upload limits
- question order/round order is invalid in a way the app cannot safely normalize

## Warning validations

Warnings should not block draft save, but should be visible:

- very long question text
- very long answer text
- missing package language
- missing tags
- missing age restriction or questionable age mismatch
- too many large video/audio files
- package duration likely too long/short
- repeated duplicate questions
- ambiguous answer text
- unsupported SIQ feature with fallback
- imported feature requires manual review
- media compression may reduce quality
- package has no preview/cover/logo when discovery uses it

## Info suggestions

Info messages improve quality but should stay gentle:

- add description
- add tags
- add language
- add package logo
- add difficulty/duration metadata when supported
- preview package before publishing
- add more final themes

## Validation report shape

A validation report should be structured enough for UI and tests.

Conceptual fields:

```text
health: Good | NeedsAttention | Broken | Unknown
issues: ValidationIssue[]
summary:
  criticalCount
  warningCount
  infoCount
  affectedRounds
  affectedThemes
  affectedQuestions
```

Conceptual issue:

```text
id
severity
messageKey
messageArgs
path: package | round | theme | question | media
roundIndex?
themeIndex?
questionIndex?
mediaHash?
source: editor | siq-import | backend | storage
fixHintKey?
```

Use localization keys for user-facing messages.

## Editor UX requirements

The editor should make validation actionable:

1. Show package health badge.
2. Show grouped issues by severity.
3. Let creator jump to affected question/theme/round.
4. Provide a “next problem” flow.
5. Preserve draft save when possible.
6. Block publish/play only for critical errors.
7. Explain storage/media limits before upload fails when possible.

## Storage and media preflight

Before upload/export/publish, validate:

- total package size
- individual file size
- allowed media type
- expected encoded/compressed size when available
- duplicate files by hash where possible
- unsupported codec or platform risk when detectable

Do not let upload fail as the first user-facing validation step if a client-side preflight could catch it.

## Backend vs frontend validation

Frontend validation helps creators fast. Backend validation protects data integrity.

- Frontend should validate during edit/import/publish flows.
- Backend should enforce hard limits and critical safety rules for persisted/public packages.
- Validation logic can be shared only if it does not create awkward coupling. Otherwise keep rules aligned through this spec and tests.

## Agent workflow

When changing package/editor validation:

1. Read `.agents/skills/package-editor-change/SKILL.md`.
2. Decide severity and health impact.
3. Update this spec if rule semantics changed.
4. Update localization keys for new messages.
5. Update OpenAPI if report/issue shape crosses backend/client contract.
6. Add focused tests or fixtures where practical.
7. Report validation behavior and checks in PR summary.

## Done when

A package validation change is done when creators can understand what is wrong, where it is, whether it blocks publish/play, and what to do next.
