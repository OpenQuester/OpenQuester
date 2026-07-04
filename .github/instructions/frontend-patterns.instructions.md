---
applyTo: "client/**/*"
---

# OpenQuester frontend pattern reminders

Canonical source of truth: `client/AGENTS.md`.

Use this file only as a quick Copilot reminder.

## Localization

- Edit JSON in `client/apps/client/assets/localization/`.
- Regenerate keys with `melos run gen_locale` or the app-local helper when appropriate.
- Use `LocaleKeys.*.tr()` and `plural()` helpers instead of hard-coded user-facing text.
- Organize new keys by feature and intent: `title`, `actions`, `errors`, `validation`, `states`.

## State and lifecycle

- Prefer `WatchingWidget` for controller-backed UI.
- Prefer `ValueNotifier` for small reactive state and `StreamController.broadcast()` for streams.
- Dispose controllers, animation controllers, focus nodes, text controllers, and stream controllers.
- Use `unawaited(...)` only when fire-and-forget is intentional and errors are handled/logged upstream.

## Navigation

- Use Auto Route generated routes and `.push(context)` / `AppRouter.I.replace(...)` patterns used nearby.
- Do not manually construct raw route strings when generated routes exist.

## Gameplay UI

- One phase should expose one primary action per role.
- Disabled actions must explain why they are disabled.
- Buzzer/answer UI must consider Locked, Ready, Pressed, Missed, and FalseStart states.
- See `docs/specs/game-state-matrix.md` and `docs/specs/buzzer-state-machine.md` before changing game screens.

## Quality

- Keep widgets small enough to review; extract complex UI into focused private widgets.
- Prefer `const` where possible.
- Fix analyzer/lint issues before handing off.
