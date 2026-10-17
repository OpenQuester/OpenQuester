# PR #446 review change map

Review snapshot: 2026-10-17; starting head `9139147e7c5f9ddb53cc9a5fa46e5fe544eaf7e1`. Source: [PR #446](https://github.com/OpenQuester/OpenQuester/pull/446), one submitted review by sukui24, 49 inline comments and no conversation comments. All inline threads were unresolved at collection. This map covers the submitted review, not unsubmitted findings from earlier UI audits.

Each piece follows analyze → plan → implement → applicable logic regression/integration coverage → tests and corrections. Existing expected behavior is checked against requirements; failed assertions are not weakened to match defects. Style, naming and type-only edits use static checks and relevant existing tests rather than artificial style tests.

The general review applies across PR-touched backend files: braces, spacing between logical blocks, descriptive names, positional arguments for small parameter lists where clearer, and ORM operations where practical. The readability pass follows the functional pieces so its diff can be reviewed separately.

The pieces share these dependencies; each was analyzed and verified separately:

| Pieces | Connection |
| --- | --- |
| A1 → A2 | Admin lookup and role contracts support shared queued actions. |
| B1 → B2 | The cron service boundary owns batched guest cleanup. |
| C1 → C2 → C3 | Upload contracts feed quota checks; repository queries preserve those results. |
| B2 ↔ C3 | Guest removal and unused-file detection share storage persistence. |
| D1 → D2 → D3 → D4 | Action names, question contracts, transitions and stored settings share the game state model. |
| E2 | Statistics query refactoring is independent of gameplay behavior. |
| E1 | Final mechanical readability pass across completed backend pieces. |

## A1: Admin list, details and role types

Status: implemented in `b6c6ff53`. Admin details reuses one game entity; pure DTO mapping lives in GameMapper with metadata loaded separately. Role/pagination types are explicit. Actor and target moderation roles use one projected IN lookup, preserving missing/deleted-user and self/staff guards. All 20 AdminModeration cases passed.

- [4286318656](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4286318656) — `server/src/application/services/admin/AdminGameService.ts`: You need to add implementation with correct generic type, for example you can look at UserPaginationOpts
- [4286684753](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4286684753) — `server/src/application/services/admin/AdminGameService.ts`: .get and .getGameEntity both calls inner getGame method, which calls hgetall causing 2 requests for 1 action. You can just partly inplement what .get has - getGameEntity, save it into variable and then into second variable just save `this.gameService.gameToListItemDTO(firstVariable)`. But there's one more improvement - gameToListItemDTO should be a mapper method, not a gameService, so it should be moved and then reused, so there's even no need to reimplement it or adapt it in game service
- [4287904128](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4287904128) — `server/src/application/services/admin/AdminService.ts`: emits 2 events (requests), probably need to implement a way to fetch both in one request (using SQL IN or something like that). Simple `in` method should be enough with `selects` options
- [4302369020](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302369020) — `server/src/domain/types/admin/AdminTypes.ts`: bad type

## A2: Shared moderation actions and queued close lifecycle

Status: implemented in `b6c6ff53`. Normal pause/resume/kick handlers recheck trusted moderator authority; closing cleanup runs inside the queued lifecycle. Held-lock regression, missing-game HTTP 404 and forged-moderator rejection passed, followed by all 20 AdminModeration tests.

- [4283045133](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4283045133) — `server/src/application/config/ActionHandlerConfig.ts`: I don't like separate events for actions that we already have for showman. It's better to adjust showman actions guards to allow admins use them, instead of implementing same thing twice
- [4286302980](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4286302980) — `server/src/application/services/admin/AdminGameService.ts`: gameRepository used only here and it violates DI rules where we should avoid injecting repositories into service unless service is related to repository.
- [4286742969](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4286742969) — `server/src/application/services/admin/AdminGameService.ts`: submitAction
- [4287310865](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4287310865) — `server/src/application/services/admin/AdminGameService.ts`: This is bad logic. First of all the flow.

## B1: Cron service boundaries, defaults and cleanup readability

Status: implemented and committed in `43f24509`. Guest job uses StorageCleanupService, explicit cron/day fallbacks, BATCH_SIZE, a named cutoff duration, and a bounded while loop. S3 cleanup uses braces. Static checks and existing cleanup integration passed.

- [4283608487](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4283608487) — `server/src/application/factories/CronJobFactory.ts`: Could be bad dependency on repository, generally it's not recommended to inject repos inside service, will check later in the code
- [4284529889](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284529889) — `server/src/application/factories/CronJobFactory.ts`: This is not the best practice to pass this.env.var into args, better to use pattern from above with some default value fallback. Even tho we have default value on `Environment.ts` level, but it could be removed or something can change and then fallback here will be applied
- [4284536464](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284536464) — `server/src/application/jobs/GuestCleanupJob.ts`: BATCH_SIZE
- [4284565446](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284565446) — `server/src/application/jobs/GuestCleanupJob.ts`: why use for (;;)? It's just a while loop? Is this a attempt to avoid using `while` loop in such way?
- [4284573230](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284573230) — `server/src/application/jobs/GuestCleanupJob.ts`: `this.inactiveDays * 24 * 60 * 60 * 1000` not really readable, can be moved to a var with name like `inactiveDaysMs`
- [4284619405](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284619405) — `server/src/application/jobs/S3FilesCleanupJob.ts`: This goes into 2 lanes, so just use normal syntax with curly brackets like

## B2: Batch guest removal with retained history

Status: implemented and committed in `43f24509`. Guest rows and avatar usages are changed in transactional batches; one S3 batch follows each database batch. Regression crosses 501 guests and preserves host/player history, scores, package authorship, still-referenced avatars, recent users and registered accounts; rerunning is idempotent. Follow-up database regressions caught TypeORM automatically changing profile modification timestamps during activity tracking and guest retention. Both writes now explicitly preserve those timestamps, matching the prior queries; first/stale activity and the one-hour throttle remain covered.

- [4284555448](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284555448) — `server/src/application/jobs/GuestCleanupJob.ts`: Need to double-check stastistics and games saving. We will for sure save games, players, their score and game chronology. I don't think this is a problem right now, but we should keep it in mind
- [4284596201](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4284596201) — `server/src/application/jobs/GuestCleanupJob.ts`: This is very bad loop. We call removeGuest for EACH guest, which calls repository and probably does a DB operation. In such loops we have to 1. Collect all guests to remove, 2. Remove them in batch on DB level with one operation.

## C1: Package authorization and upload contracts

Status: implemented and committed in `95bd2ddb`. Named upload/file contracts, positional service calls and one permission-first package lookup. Active/banned-user checks remain necessary at the application boundary and are documented. Existing Joi size validation and wire response names are preserved. Three focused suites passed: 24 tests.

- [4295051654](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4295051654) — `server/src/application/services/package/PackageService.ts`: Need a strict type and schema validation on that one.
- [4295105471](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4295105471) — `server/src/application/services/package/PackageService.ts`: It uses this.getPackageRaw inside this.assertCanEditPackage, so it's a double call of same function and double call to external service (redis/db). Just get package info and pass it down to this.assertCanEditPackage. If needed create 2 functions where one calls package retrival, and second just accepts it. Or call it if no package provided, but it's less safe design since it can be used wrongly by bad programmer. 
- [4295663996](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4295663996) — `server/src/application/services/package/PackageService.ts`: This code is hard to read. Not clear namings, no comments. I'm reading this and cannot understand, is that somehow changing package, just updating sizes? If sizes update, why package created? I don't understand the purpose of method (i will understand if read it enough and go in deep implementations of methods, but this is not how readable code should look - i need to understand purpose without checking implementations of inner code, which is achieved using good self-describing namings and comments where needed)
- [4295784371](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4295784371) — `server/src/application/services/package/PackageService.ts`: This feels wrong since we have some user checks on middleware level, but i didn't dig to deep and don't remember. Just double-check if this is necessary on every usage of method and if needed leave a docstring comment about purpose of caller to check user if it's banned or something else.
- [4295802767](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4295802767) — `server/src/application/services/package/PackageService.ts`: Also not sure if this method should live in a service, double-check if there's a better placement for it
- [4299065975](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299065975) — `server/src/application/services/package/PackageStorageService.ts`: poor typing, try to not use generics like that. Implement type/interface, export and use it
- [4299071760](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299071760) — `server/src/application/services/package/PackageUploadService.ts`: I think we already have a type for filename + path. If not - should be added and used as type/interface
- [4299075218](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299075218) — `server/src/application/services/package/PackageUploadService.ts`: Missing and unknown what? links? names? ids?

## C2: Storage quota logic names and placement

Status: implemented and committed in `43f24509`. Pure utilities moved to camelCase domain module; clear names, braces and named quota result types. Verification now precedes reading measured sizes. The new HTTP regression failed with the original order (expected 413, received 200) and passed after correction. Storage/upload suites passed: 15 tests, including B2.

- [4299907135](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299907135) — `server/src/application/services/storage/StorageQuotaService.ts`: Those are not readable for human. I explained it in general review comment, check it out.
- [4299918969](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299918969) — `server/src/application/services/storage/StorageQuotaService.ts`: Also it is not recommended to export function from a file with PascalCase, cause this case means that this file exports a service that is described in it's name. Files that exports just functions and has no exported class uses camelCase, so it should be either separated or included in exported class (if it matches class meaning and can be reasonably stored as method of a class)

## C3: Storage ORM queries preserving quota and reference semantics

Status: implemented in `f8d6b4bf`. Standard queries use TypeORM; one documented bulk PostgreSQL unnest update remains because duplicate MD5 rows cannot use upsert without changing semantics. Four suites passed all 31 tests, including duplicate-file quota counting, package exclusion, multiple permissions, verified sizes and legacy direct references. A separate focused regression preserves the original future-timestamp cleanup guard.

- [4299103253](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299103253) — `server/src/infrastructure/database/repositories/StorageRepository.ts`: This file generally contains a lot of raw queries. I'm very positive that we can avoid using them, so pls consider

## D1: Explicit gameplay action names and semantics

Status: implemented in `b6c6ff53`. Internal action/usecase names are explicit; public event values remain unchanged. The secret action selects an allowed question price independently of player score, so SelectSecretQuestionPrice describes its mechanics accurately. A free wrong answer produces a valid zero-point ruling: the new transport regression first failed with NOTHING_TO_UNDO, then passed after changing the absence guard. The final four-suite gameplay run passed all 18 tests.

- [4282927410](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4282927410) — `server/src/application/config/ActionHandlerConfig.ts`: Bad naming. It's not really understandable what toggle means in this case
- [4282936989](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4282936989) — `server/src/application/config/ActionHandlerConfig.ts`: This one is also not understandable to me. How can we undo answer result and what is the logic of this action? I will read it's code later, but it's either naming issue or useless piece of code
- [4282942103](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4282942103) — `server/src/application/config/ActionHandlerConfig.ts`: Also a bad naming probably or useless code
- [4283012504](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4283012504) — `server/src/application/config/ActionHandlerConfig.ts`: All play? Maybe "For everyone"?
- [4283016517](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4283016517) — `server/src/application/config/ActionHandlerConfig.ts`: Secret question price? I suggest it's more like "Secret quesiton bet"

## D2: Named question and transition contracts

Status: implemented. Named domain question/transition contracts and removed unused price-selection argument. TypeScript and scoped lint passed; included in 11-suite / 70-test gameplay verification.

- [4299048856](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299048856) — `server/src/application/services/game/TransitionResourceService.ts`: poor types, try to never return objects and make them interfaces or types
- [4299349263](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299349263) — `server/src/application/services/question/SecretQuestionService.ts`: again input with loose types
- [4299352703](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299352703) — `server/src/application/services/question/SecretQuestionService.ts`: Bad inline type
- [4299357333](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299357333) — `server/src/application/services/question/SecretQuestionService.ts`: question is unused here
- [4302283208](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302283208) — `server/src/domain/logic/question/QuestionContentPlanLogic.ts`: Bad type
- [4302325980](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302325980) — `server/src/domain/logic/question/ShowAnswerLogic.ts`: bad type

## D3: Readable question and timer transitions

Status: implemented. Accurate transition comments, private methods after public methods, named everyone-answer reveal helper, explicit mode/price guards, switch-based phase resolution, and corrected comments/destructuring. TypeScript/lint and existing gameplay verification passed.

- [4299373373](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4299373373) — `server/src/domain/mappers/StakeBiddingMapper.ts`: Why use `params.bidTimeMs` if we unpack all values above? Just unpack `bidTimeMs` as well
- [4302232604](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302232604) — `server/src/application/services/timer/TimerExpirationService.ts`: tryTransition calls should have a comment what it tries to transition. For example
- [4302257659](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302257659) — `server/src/application/services/timer/TimerExpirationService.ts`: private methods should be placed after all public methods
- [4302323159](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302323159) — `server/src/domain/logic/question/QuestionPickLogic.ts`: Double jsdoc comment
- [4302331957](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302331957) — `server/src/domain/mappers/GameQuestionMapper.ts`: Had to read this comment few time to understand what it means, reword it
- [4302339934](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302339934) — `server/src/domain/state-machine/handlers/all-play/AllPlayReviewingToShowingAnswerHandler.ts`: This is a bunch of text with no explaining, can be moved to self-described named private method
- [4302362355](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302362355) — `server/src/domain/state-machine/handlers/special-question/ChoosingToStakeBiddingHandler.ts`: `AllPlayLogic.modeOf(question) != null` is more clear i think
- [4302365297](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302365297) — `server/src/domain/state-machine/handlers/special-question/SecretTransferToAnsweringHandler.ts`: Change to this
- [4302367737](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302367737) — `server/src/domain/state-machine/types.ts`: can be done with `case`, same as all other codeblocks

## D4: Game settings ownership and required Redis settings

Status: implemented. DTO contains types only; GameSettingsLogic owns normalization, defaults/enums have dedicated domain modules, and stored settings are required. Settings roundtrip and missing-settings rejection regression included in the 11-suite / 70-test gameplay run.

- [4302377003](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302377003) — `server/src/domain/types/dto/game/settings/GameSettingsDTO.ts`: Should be moved to some logic class or something like that. And also this file named in PascalCase, the logic behind it i already explained, so it's applied here and in all other new files. Probably a lot from here or even all that file just should be moved to types domain
- [4302382795](https://github.com/OpenQuester/OpenQuester/pull/446#discussion_r4302382795) — `server/src/domain/types/dto/game/GameRedisHashDTO.ts`: we have no older games, so if this is required for new games - make it required

## E1: General backend readability

Status: implemented. Reviewed all 203 PR-touched backend source files and added braces or logical spacing in 68 files, using the existing formatter. The backend agent guide records these conventions. Lint and build passed. No style-only tests were added.

## E2: General review SQL preference in statistics

Status: implemented in `f8d6b4bf`. Player statistics totals, recent games and leaderboard use TypeORM QueryBuilder over model relations. Database aggregate expressions, ranking, date filtering and account exclusions are unchanged. StatsAndReports passed within the final four-suite / 31-test package, storage and statistics run.


## Verification environment and evidence

The remote branch advanced during implementation with `753b794f5`, `9bdc8fba0`
and `4fe13d25b`. These overlapping review fixes must remain in the PR history.
Integration preserves their coordinated public action renames across backend,
OpenAPI and web while retaining the regressions and safeguards described above.

Focused transport runs used isolated local PostgreSQL on 55432 and Redis on
56379. The pipeline enforced serial database access and open-handle checks.
JSON results and per-piece working notes are retained locally under
`.codex/pr-446-review/` (not published as repository sources).

An initial combined package/storage/statistics run passed all 31 assertions but
failed suite teardown when a logger close exceeded its existing deadline.
An independent VS Code Jest watcher was simultaneously writing the same log
files outside the pipeline lock. It was stopped; the isolated upload suite
passed 7/7, followed by the unchanged four-suite run passing 31/31 with exit 0.
Concurrency was confirmed; causation of the stalled logger sink was not proven.
No timeout, assertion, or cleanup requirement was relaxed.

A separate intermediate moderation run encountered a partially edited storage
module during package setup, before the close behavior was reached. All-source
freezes were then used for verification. The stable close regression and full
moderation suite passed; this intermediate setup failure is not a known defect
in the completed source.

The first full backend snapshot run completed 108 suites / 1004 tests, with
107 suites / 1003 cases passing and no open handles. Its sole failure was the
existing transport-policy check rejecting an aliased scenario actor call in the
new moderation regression. The call now uses the required
`scenario.actor(...).emit(...)` form; payloads and assertions are unchanged.
The two timestamp regressions also failed against the initial ORM writes before
the implementation was corrected. Their expected values were preserved.
