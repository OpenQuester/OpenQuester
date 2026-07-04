---
applyTo: "client/**/*"
---

# OpenQuester frontend core instructions

This file exists for GitHub Copilot compatibility. The canonical frontend agent instructions live in:

- `AGENTS.md` — repository-wide router
- `client/AGENTS.md` — Flutter/Melos/frontend source of truth
- `.agents/skills/frontend-game-ui-state/SKILL.md` — game UI state workflow
- `.agents/skills/package-editor-change/SKILL.md` — package/editor workflow
- `docs/specs/game-state-matrix.md` — role/phase/CTA expectations

## Essentials

- Use `common_imports.dart` in app code where nearby files use it.
- Files are `snake_case`; classes are `PascalCase`; private members use `_prefix`.
- Prefer `WatchingWidget` + `watchValue`/`watchIt` for reactive UI already built on controllers.
- Controllers should own state through `ValueNotifier` or `StreamController` and dispose/close resources.
- Use `getIt<T>()`, `watchIt<T>()`, and `createOnce(...)` consistently with nearby code.
- Use `LocaleKeys.*.tr()`; update localization JSON and regenerate keys when adding user-facing strings.
- Do not manually edit generated files unless a scoped doc explicitly says the file is temporary/manual.

## Gameplay UI rule

For game screens, do not add a button or widget without checking role, phase, disabled reason, timer state, and feedback. Use `docs/specs/game-state-matrix.md` and `docs/specs/buzzer-state-machine.md` when changing answer/buzzer/question UI.

## Validation

Use `client/AGENTS.md` and `docs/agent/03-verification-matrix.md` for commands. Report which Melos/Flutter checks were run.
