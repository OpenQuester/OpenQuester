# client/AGENTS.md — frontend source of truth

Use this file for all changes under `client/`. The root `AGENTS.md` is only a router; this file owns Flutter/Melos/frontend conventions.

## Workspace shape

`client/` is a Dart/Flutter workspace managed with Melos.

Main areas:

- `apps/client/` — main OpenQuester Flutter app.
- `packages/openapi/` — generated Dart API/Socket contract package from `openapi/schema.json`.
- `packages/siq_file/` — SIQ parsing/import support.
- `packages/oq_editor/` — package editor UI/controller utilities.
- `packages/oq_compress/` — package media encoding/compression pipeline.
- `packages/oq_shared/` — shared client-side utilities/models.

The app uses GetIt/Injectable-style DI, WatchIt reactive widgets, Auto Route, Easy Localization, generated assets, generated API models, and custom editor packages.

## Context7 rule for frontend work

Before frontend code changes, use Context7 for current Flutter/Dart docs and for docs of every touched third-party package. If Context7 is unavailable, say so and rely on existing project code patterns instead of inventing APIs from memory.

## Commands

Run from `client/` unless a package-specific task requires a narrower working directory.

```bash
flutter pub get
melos run pre_build       # gen_api + gen_files + gen_workers + gen_locale
melos run gen_api         # regenerate OpenAPI Dart client/models
melos run gen_files       # build_runner for packages that need it
melos run gen_locale      # localization keys
melos run analyze         # dart analyze --fatal-infos
melos run test            # tests across packages
melos run format          # dart format lib
```

Use focused package/app commands only when you know the affected scope. Report exactly what was run.

## Frontend architecture

Common app direction:

```text
core/        -> DI, routing, theme, app shell
features/    -> feature modules: controller/data/view/utils
connection/  -> API and Socket.IO integration
data/        -> app data models and adapters
ui/          -> shared reusable UI
packages/    -> editor/SIQ/compression/shared libraries
```

Match nearby structure before creating new folders. Avoid creating new architecture layers for a small task.

## Imports and naming

- Use `common_imports.dart` in app code where nearby files do so.
- Files: `snake_case.dart`.
- Classes/enums/widgets: `PascalCase`.
- Variables/methods: `camelCase`.
- Private members: `_prefix`.
- Prefer named classes and explicit small widgets over anonymous giant builders.
- Avoid manually editing generated files.

## State and DI

Preferred patterns:

- `getIt<T>()` for service/controller lookup.
- `watchIt<T>()` or `WatchingWidget` + `watchValue(...)` for reactive UI.
- `createOnce(...)` for expensive local controller creation tied to widget lifecycle.
- `ValueNotifier<T>` for focused state.
- `StreamController<T>.broadcast()` for multi-listener streams.

Resource rules:

- Dispose `ValueNotifier`, `StreamController`, `AnimationController`, `TextEditingController`, `FocusNode`, video/audio controllers, and timers.
- Use `unawaited(...)` only when the async work is intentionally fire-and-forget and failures are handled/logged elsewhere.
- Do not hide state inside widgets when the existing feature owns it through a controller.

## Gameplay UI rule

OpenQuester wins by making game state visible. For game screens, every change must consider:

- phase/state
- current role: showman, player, spectator
- primary CTA for that role
- disabled reason
- timer/media waiting state
- success/failure/missed feedback
- desktop and mobile input affordances
- localization

Read before changing gameplay UI:

- `.agents/skills/frontend-game-ui-state/SKILL.md`
- `docs/specs/game-state-matrix.md`
- `docs/specs/buzzer-state-machine.md` for answer/buzzer work
- `server/docs/final-round-flow.md` for final round work
- `server/docs/media-download-sync.md` for media readiness/playback work

Do not treat disabled reasons, phase labels, and result feedback as optional polish. They are part of correctness.

## Package editor rule

The editor is a strategic product surface, not just a JSON form. For editor/import/export changes, read:

- `.agents/skills/package-editor-change/SKILL.md`
- `docs/specs/package-validation-spec.md`
- `docs/specs/siq-compatibility-matrix.md`

Preserve these concepts:

- local package editing through `OqEditorController`
- `.oq` import/export through archive helpers
- `.siq` import through `siq_file` + `SiqImportHelper`
- media references by hash
- media encoding/compression progress
- package validation and publish readiness as user-facing concepts

## Localization

- User-facing strings must use localization keys.
- Add keys to JSON in `apps/client/assets/localization/` and regenerate with `melos run gen_locale` when applicable.
- Prefer feature-grouped keys: `title`, `actions`, `states`, `errors`, `validation`, `tooltips`.
- Do not hard-code English/Ukrainian text into widgets except temporary debug-only code.

## Generated code

Generated or regeneration-sensitive areas include:

- OpenAPI Dart models/client in `packages/openapi/`.
- Auto Route generated routes.
- Easy Localization key files.
- Freezed/JSON serializable files.
- Generated workers/assets.

If a task changes inputs to generated code, update the source input and run the correct generator. Do not manually patch generated output unless the current code already marks a temporary manual exception and the PR calls it out.

## UI quality

- Prefer `const` where practical.
- Keep files and widgets reviewable; split large widgets into private focused widgets.
- Use existing theme extensions and spacing helpers.
- Prefer `AdaptiveDialog` or existing project-specific wrappers over raw framework primitives when nearby code does so.
- Mobile/desktop layouts must keep the primary action obvious.
- For animations, respect lifecycle and avoid motion that hides current state.

## Testing and validation

Use `docs/agent/03-verification-matrix.md` for the full matrix.

Typical checks:

```bash
melos run pre_build
melos run analyze
melos run test
melos run format
```

For UI-only changes without generated input changes, a narrower `melos run analyze` + focused tests may be enough. Always state what was not run.
