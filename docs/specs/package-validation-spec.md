# Package validation and publish-readiness spec

## Structured SI scripts

Script imports keep a typed program and authored file and text occurrences in the
same draft and `.oq` archive. The editor preserves the imported order and playtest
runs the program. Missing or cyclic current-question references, unknown operations,
and managed client input require repair before publication or playtest. HTML still
requires explicit removal consent.

Archived script operations and modes use exact string values. The local playtest
uses the same answer window defaults, valid select orders, pass rules, and
bidding timeouts as the server.

For a structurally valid script, the `.oq` reader resolves content orders
against files and text in each phase, and select orders against the question's
options. It checks the answer key and required number or point data. A point
ask requires an image as the last occurrence of the active presentation. The
editor retains invalid references and operands in the draft and reports the
affected script step. Publication and playtest require a valid script. The
creator can repair the source archive or explicitly convert the question to a
regular question in the editor.

Expanded occurrences, including repeated references, count against the existing
30 steps per question or answer phase and 10 files per authored group. Five or
more visuals in one group use the existing sequential adaptation. Script command
count has a separate bound and does not increase the media limits.

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
- question has neither text nor media, except a valid secretRules outcome=award
- answer has neither text, answer media nor a valid numeric target where answer is required
- media reference is missing/broken
- media file type is not allowed
- package contains unsupported SIQ feature without safe fallback
- final round lacks enough valid themes/questions for current gameplay rules
- package exceeds hard storage/upload limits
- question or answer exceeds 30 authored steps or 10 file occurrences in one
  authored step. This includes text-only steps and newly started background audio.
  Repeated hashes count once per occurrence. Logos, choice images, and background
  audio carried from earlier steps add nothing to the current step's file count.
- question order/round order is invalid in a way the app cannot safely normalize
- number-answer target is missing or non-finite
- point-answer target is missing, non-finite, outside the `[0, 1]` coordinate
  range, or has no question image

The web editor and `.oq` reader preserve a selected number/point answer mode
even when its target is incomplete. Drafts remain editable; critical validation
blocks publishing instead of silently changing the mode to text.

| Field | Publication rule |
|---|---|
| `pointImageOrder` | Must identify exactly one question image. Null/absent keeps the first ordered image. |
| `answerPoint.imageAspectRatio` | Web publication measures the optimized target image; decode failure blocks publication and preserves the source for retry. Legacy native packages keep their old checking until republished. |
| `answerPoint.sourceGeometry` | Optional private `{ kind: "sigame", aspectRatio: positive finite number }`. SIQ checking uses `hypot(a*dx,dy) <= max(.02,deviation)` and defaults to `.02` when no deviation is supplied. Measured image aspect does not affect this calculation. Invalid source points/targets remain drafts with critical validation. Native radius/target edits remove this metric; autosave, text edits, re-encoding and archive round-trips retain it. Target crop/rotation/replacement resets coordinates and metric; undo restores them together. |
| `textItems` / `answerTextItems` | Distinct nonnegative integer orders within their phase, shared with that phase's files. Blank screen clears and private replic pauses require a positive duration. Drafts flag untimed blank items before publish or playtest. Null/absent preserves legacy ordering and ties. |
| Authored text timing | Optional `durationMs` / `textDurationMs` is an integer from 1 to 120,000 ms. Text closes its playback group. Older text wait flags can be read, and older private text stays private. |
| `answerDurationMs` | Optional nullable integer 0–2,147,483,647 ms. Null/0 uses room default; no change to `answerDelay` or post-buzz submit time. |
| SIQ content repairs | Question-local `compatibilityIssues` retains bounded source timing/placement/item evidence in drafts and `.oq`; unresolved critical issues block publish and playtest. It is archive metadata and is forbidden by HTTP publication. |
| Final audio/video `displayTime` | With non-null `textItems`, each duration must be an integer from 1 to 120,000 ms. |
| `correctChoiceOrder` | An explicit key must identify one choice, including image-only choices. Removing it or importing an invalid key blocks publication until repaired; null/absent retains legacy behavior. |

Text steps/image orders are public; answer coordinates stay private until reveal.
**Correct answers** stores the first line as `answerText`, others as `rightAnswers`;
choices keep their selected key plus **Also accept** aliases. Numeric mode keeps
hidden text lists in the draft/archive but omits them from editor publication and
preview, using the numeric target instead. Drafts and `.oq` archives retain
incomplete targets for repair; existing packages and direct uploads are not migrated.

## Price and participation fields

`price` remains the nominal board value. Optional `realPrice` must be an integer
from 0 to 1,000,000 or null; null/missing uses the nominal and zero stays zero.
It survives draft save, OQ export/reimport, create and replacement. A fixed actual
price and legacy secret `allowedPrices` cannot both be authored: the creator must
clear one before publication/playtest. A single-player auction preview compares
its cap against the actual base, while board cells retain the nominal.

Simple and legacy choice questions accept `subType=forEveryone`; stake/noRisk
keep their existing participation values and formulas. Normal-for-all scoring
uses the room's penalty, not an inferred SIQ setting. Final questions retain the
existing final bidding flow.

### Secret rules and import repair

`secretRules` is optional and only belongs to secret questions. A complete valid
award rule permits an empty prompt/right answer; ordinary questions retain their
content checks. The editor explains the award after-transfer behavior and offers
fixed actual price, nominal round extrema or compact integer ranges. Legacy OQ
allowedPrices remains a 2–5 value list. Dynamic rules conflict with authored
realPrice; secretRules conflicts with allowedPrices. Bounds and choices must be
safe integers within the server's 1,000,000 price cap; explicit realPrice=0 is valid.

Question-local critical `compatibilityIssues` survive drafts and `.oq`, with
bounded typed non-HTML source and source-only media. They follow the question's
stable draft ID after moves. Save/export remain available, while publication and
local playtest block; the server rejects archive-only repair markers. The editor
has an explicit, confirmed conversion to a regular question describing which
unsupported rules/input modes are discarded. Hiding the import report alone
does not clear repair state. The existing HTML preflight/removal consent still
applies, including HTML found inside retained source metadata.

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

React `.siq`/`.oq` imports report each unsupported HTML question before processing
media. After explicit consent, the entire affected question and containers made
empty by removal are discarded; a local import warning persists with the draft.
An archive with no remaining questions cannot be imported. The original archive
is never modified. This is React-specific and does not change the server contract.

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


Media limits apply before playback scheduling. Archive import reports the round,
theme, question, phase, counts, and affected step when applicable. Repair the
original archive before retrying. The editor keeps invalid drafts editable and
blocks publish and playtest. The API checks create, replacement, and package
selection for a new game, including older published packages. Existing games keep
their saved package data.

Select publication requires at least two nonempty text/media options, unique
nonnegative integer orders, and a valid explicit correctChoiceOrder for the new
answerType=select format. REST also accepts a numbered blank option for legacy
`type=choice` without explicit `answerType=select`. Legacy choice retains unambiguous
text judging when its key is absent. There is no arbitrary maximum of eight options. Source labels
are display/archive metadata; selection payloads use choiceOrder. Drafts retain
unresolved select source and the selected format. Selecting a replacement key is
an explicit repair. The editor still blocks publication and playtest for empty
or missing-media options. Switching the legacy choice mechanism to another type retains the
select format. Option media supports image/audio/video through the existing
local playback controls, separately from selecting an answer.

For explicit `answerType=select`, the editor hides the legacy “Also accept”
field: only the keyed option is correct. Existing `rightAnswers` remain in
drafts and archives, but are not presented as correct answers during gameplay
or playtest. Legacy choice keeps its text aliases.
