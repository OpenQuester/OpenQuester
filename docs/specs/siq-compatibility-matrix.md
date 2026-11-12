# SIQ compatibility matrix

This spec defines how OpenQuester should handle SIGame `.siq` import compatibility. It is both a product spec and an agent guardrail.

Status note: this is a target compatibility matrix and audit baseline, not a claim that every status is already implemented. Verify current parser/editor/game code before marking a SIQ feature as done.

Implementation roadmap: [SIGame question types, combinations and SIQ parser plan](../plans/sigame-question-compatibility.md)
(2026-11-10; staged implementation). It preserves OpenQuester types, media limits and the
explicit HTML prohibition.
The plan intentionally ignores separate SIQ question themes and distinguishes the
visible board price from the effective `realPrice` through centralized accessors.

The implementation supports modern and legacy aliases, normal and stake questions
for everyone, exact select identity, SIQ point geometry, secret prices and awards,
authored answer windows and content, and validated structured scripts. Unknown or
unsupported behavior stays in a repair draft when source preservation is safe.
HTML questions require explicit removal consent. The plan contains the acceptance
cases and their verification gates.

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
| Content order and timing (`placement`, `waitForFinish`, `duration`) | SupportedWithConversion | Screen text, blank timed screen clears and private replic/say occurrences keep their order, duration and wait flags through the existing content plan. A replic step keeps the previous screen; pure oral questions show a localized showman-reading cue. Unknown types/placements and invalid timing remain critical draft/archive repairs. The accepted 5+ visual adaptation still applies. |
| Answer content | SupportedWithConversion | `right` remains checking data. Ordered `answerTextItems` share the order space with `answerFiles`, including legacy text after marker. Answer content is private until reveal; replic text remains showman-only afterwards. `info/comments` becomes reveal-only `answerExplanation`; `showmanComments` is a private instruction. |
| `answerDuration` | SupportedWithConversion | Absent/0 uses room default; positive integer seconds become `answerDurationMs` once. It overrides the post-presentation pressing/direct/all-play/final window, never the post-buzz submit timer. Invalid/overflow values remain blocking repairs. Structured scripts can set a separate duration per ask. |
| Select / legacy choice | SupportedWithConversion | Select is independent of mechanics. Unique source labels map to option orders; unresolved identities stay in repair drafts. See [Select answer format](#select-answer-format). |
| Stake/bidding question | SupportedWithConversion | Standard stake uses the auction. Stake-all gives each eligible player a private personal stake and grades against it. |
| Secret/transfer question | SupportedWithConversion | Modern and legacy cat/bagcat normalize to secretRules without a separate theme. Fixed actual prices use realPrice; dynamic ranges retain endpoints/step and explicit opener/receiver order. Award is private until accepted transfer. See the implementation note below. |
| No Risk question | Supported | Native No Risk preserves zero loss on a wrong answer. An explicit modern multiply template retains the room's wrong-answer policy. |
| Hidden/unknown price modes | Partial or UnsupportedWithFallback | Use safe fallback and warn; do not silently change strategy. |
| Final round | Partial | React importer converts a non-last final round to a simple round before parsing questions, preserving all its questions and warning `finalAsSimple`. The valid last final keeps one question per theme and reports the number omitted with `extraFinalQuestions`; creators must review the source for additional questions. Other final metadata remains partial. |
| Authors/sources/comments | Partial | Package and question authors and sources are kept (`authors`, `sources`) and shown with the answer and on the package page; round and theme authors/sources are dropped. Comments go to descriptions / `questionComment`. |
| Multiple right answers / wrong answers | Supported | The first right answer is `answerText`, the rest go to `rightAnswers`; wrong answers go to `wrongAnswers`. The showman sees both; extra right answers are revealed with the answer and count for native choice auto-check. SIQ select keeps resolved source right labels as authoring metadata through publication and export. |
| Point-answer geometry | SupportedWithConversion | Standard SIQ point questions target the last source content occurrence only when it is an image. `pointImageOrder` survives repeated hashes. `answerPoint.sourceGeometry` preserves the independent SIGame aspect (1 for old x,y answers), with minimum deviation .02. Web publication measures the selected final image without replacing the source metric. Missing targets/invalid points remain point mode, with repair warnings and critical publication/playtest validation. Native OQ geometry and legacy first-image fallback are unchanged. A script point ask targets the last authored occurrence in its active presentation when that occurrence is an image. |
| HTML questions (React SIQ/OQ import) | UnsupportedWithFallback | Requires [explicit removal consent](package-validation-spec.md#editor-ux-requirements); no HTML execution. Ambiguous manifest aliases are rejected. |
| Structured non-HTML question script | Supported with limits | Exact standard templates with equivalent native mechanics compile to complete native questions for direct upload. Other validated scripts, including modern `setPrice/multiply`, keep their ordered typed operations. Unsupported operations, references, and client input require repair. HTML follows existing removal consent. |
| Unsupported media reference | UnsupportedCritical | Critical validation error. |
| Unknown XML node/attribute with gameplay impact | Unknown | Add to unsupported feature accumulator. |

## Normalization, repair and script execution

`normalizeSiqQuestion.ts` owns modern/legacy aliases and secret parameters.
Modern NumberSet step=0 is continuous over integers; legacy `[a;b]` has only
endpoints. `0/0` snapshots extrema of full nominal playable round prices,
including hidden cells and excluding price=-1. Fixed amounts live only in
`realPrice`; dynamic choices change live state, never the package or board.
Separate source themes are deliberately ignored in gameplay, without repair.
A custom content parameter named `theme` still remains in retained private source.

Unknown/custom behavior is retained as bounded typed non-HTML source attached
to the question's `compatibilityIssues` and stable draft ID. The existing import
report and package health show critical repair issues. IndexedDB and `.oq`
retain them and their source-only media; publication and playtest are blocked.
An explicit **Convert to a regular question** action describes and confirms the
loss before clearing the unsupported behavior. This is not script execution.
The registered archive diagnostics include `siqCompatibility`, `contentNeedsRepair`
and `choiceCorrectUnresolved`; source coordinates and typed source are optional
for specialized diagnostics and are validated when present. SIQ import and
`.oq` export/import share the same per-question diagnostics bound, independent
of the gameplay content limits. They reject oversized metadata without dropping
individual repair sources.

The game, editor and playtest support secret transfer, public-price, historical
opener-price and score-only award flows. The nullable `secret_rules` and
`real_price` columns are additive. Existing OQ allowed price lists retain their
legacy behavior.

The script allowlist is `setAnswerType`, `showContent`, `askAnswer`, `setAnswerer`,
`announcePrice`, `setPrice`, `setTheme`, and `accept`. References resolve against
the current question, including redirected standard type parameters. The `right`
fallback reveals the applicable text, option content, or point. `setTheme` is a
no-op and the board theme remains. The interpreter does not run code or fetch
remote media. Historical `setPrice/noRisk` doubles the right amount with zero
loss on a wrong answer and can compile to native No Risk when the template
matches. Modern `multiply` stays scripted, doubles the current amount, and
keeps its wrong-answer policy. Historical `withButton` and `forAll` apply the OQ
room wrong-answer penalty. The reserved `setPrice/forYourself` requires repair.

An explicit final script or modern explicit button question uses its authored
order and participation. Missing/default type and upgraded legacy `simple`
retain native final bids and manual review. Scripted final prices start from
the source question's nominal price. The zero NumberSet uses the range of
positive source nominals across all final themes, with 1–1 for an unpriced
round. A visible scripted auction publishes its base price through
`stakeQuestionData.questionPrice` while bidding is open. The auction's
`currentBidderIndex` determines who can bid after a manual bid or timeout.
Each point ask requires the active presentation's last authored
occurrence to be an image. Missing targets and unsupported playback placements
or wait flags require repair. Point asks use a 2% default tolerance in the source
geometry, including when a later script step switches the answer format.

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
- generated REST declarations in `web/src/api/schema.d.ts`
- package editor UI
- package validation spec if it changes publish readiness

## Agent workflow

When changing SIQ import:

1. Inspect parsing and conversion in `web/src/features/upload/siq.ts`.
2. Review import behavior in the adjacent tests.
3. Decide compatibility status for the changed feature.
4. Update this matrix.
5. Add/adjust report or validation behavior if user-facing risk changes.
6. Add tests/fixtures where practical.
7. Report whether generated files or OpenAPI were affected.

## Done when

A SIQ compatibility change is not done until unsupported or lossy behavior is visible to the creator. Silent degradation is a bug.


### Authored media limits and playback

SIQ preflight counts question and answer separately using the original groups.
An archive with more than 30 steps in either phase or more than 10 file
occurrences in any step is rejected with a location and count report.
Repeated references and newly started background audio count toward the limit.
The report leaves the source archive intact. HTML removal retains its existing
consent flow for otherwise eligible packages.

When a group contains five or more images or videos, OpenQuester presents its
screen media in order and reports the conversion during import. With fewer
visuals, screen audio and video can play together by default. The editor's
playback setting can make those groups sequential while keeping their visual grid.

### Select answer format

`answerType=select` is independent of simple/stake/secret/noRisk/hidden mechanics.
Legacy `type=choice` still selects options. Modern SIQ answerOptions reads only
its first content item per option. Exact, unique source labels map to integer
orders; the first source right label identifies the key. Additional right labels
are authoring metadata. Texts and media hashes do not identify options.
Invalid/duplicate option labels, an unresolved or duplicate source right label, or unsupported option content
keep the options in a repair draft and block publication/playtest until explicitly
repaired. Publication and package reads retain `selectSource.rightLabels` for
reopening and export. Each label must identify exactly one option. The list keeps
source order, with at most 1,000 distinct labels of 500 characters each. Invalid
source rights remain in the repair draft; the editor can explicitly discard the
source right list before the correct option is selected again, provided there are
no unresolved raw option contents that would also be discarded.
`correctChoiceOrder` controls judging. Raw unresolved option content and
`compatibilityIssues` stay in drafts and archives, and gameplay omits the source
right list. HTML anywhere in options still requires whole-question removal
consent. The eight-option limit is removed; the authored timeline's 10-file and
30-step limits are unchanged and do not count options as timeline steps.

Select works with normal-for-all, stake/noRisk all-play and native final
selection. Options appear in their explicit `order` in the game and editor.
The package response carries that field with each option. Audio and video
controls preview or play media independently from selecting the answer.
