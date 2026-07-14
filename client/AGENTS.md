# OpenQuester client instructions

## Workspace and tooling

- `client/` is a Dart workspace managed by Melos, not a standalone Flutter package.
- Use the SDK pinned by `.puro.json` (`flutter3389`). Run Dart and Flutter tooling through Puro when it is installed; otherwise verify the available SDK is compatible before running project commands.
- The current application is under `apps/client/`; reusable packages are under `packages/`.
- Confirm the owning app/package before editing. Do not assume legacy-looking root `lib/` paths own new work.
- Treat `pubspec.yaml` as the source of truth for workspace members and Melos scripts.

Invoke the workspace-local Melos dependency through the selected Dart toolchain. Common operations from `client/` are:

- `dart pub get`
- `dart run melos bootstrap`
- `dart run melos run pre_run`
- `dart run melos run analyze`
- `dart run melos run test`
- `dart run melos run format`

Focused generation is also available through `./oqhelper`: `pre_run`, `pre_build`, `gen_files`, `gen_indexes`, `gen_locale`, and `format`.

## Generated files

- Do not hand-edit generated API clients, localization keys, build-runner outputs, workers, or generated barrel exports.
- `openquester.dart` and generated indexes are deliberate barrel exports. Regenerate them through the project scripts instead of applying server export rules to Dart.
- When an OpenAPI contract changes, regenerate the Dart client and verify affected callers.
- For localization, edit JSON sources under the owning app's `assets/localization/`, run `./oqhelper gen_locale` or the Melos equivalent, then use `LocaleKeys.*`.

## Project patterns

- Follow nearby imports; the application commonly uses `common_imports.dart` and `package:openquester/openquester.dart`.
- Use `snake_case` files, `PascalCase` classes, `camelCase` members, and `_` prefixes for private Dart members.
- Follow the existing `get_it`, `watch_it`, `ValueNotifier`, and stream ownership patterns. Dispose controllers, notifiers, subscriptions, and streams where ownership requires it.
- Use existing Auto Route patterns for navigation and route generation.
- Reuse established responsive and dialog components such as `UiModeUtils`, `MaxSizeContainer`, and the project `AdaptiveDialog` where they match the task.
- Keep visible user text localized.
- Prefer existing feature/package organization and nearby widgets over introducing a new state-management or UI architecture.

## Verification

- Run generation when changing annotations, routes, localization sources, API schemas, or generated indexes.
- Run the smallest relevant package/app tests first.
- Run the relevant Melos analysis/test scripts for broader verification when the change crosses packages.
- Review generated diffs for accidental churn and do not mix unrelated formatting changes into the task.

## Navigation

- Workspace scripts: `pubspec.yaml`
- App package: `apps/client/`
- Shared packages: `packages/oq_shared/`, `packages/oq_editor/`
- Generated OpenAPI client: `packages/openapi/`
- Project helper: `packages/project_helper/`, exposed as `./oqhelper`
