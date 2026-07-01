---
name: frontend-game-ui-state
description: Use when changing Flutter gameplay screens, role-aware CTAs, disabled reasons, buzzer/answer UI, timers, media waiting, reconnect banners, final round UI, or game summary behavior. Avoid for non-game UI-only changes.
---

# Frontend game UI state skill

Use this skill when changing Flutter gameplay screens, game lobby/question/final UI, answer/buzzer controls, timers, media waiting, reconnect banners, game summary, or role-aware controls.

## Trigger examples

- “add action panel”
- “change game question screen”
- “buzzer button state”
- “show disabled reason”
- “final round UI”
- “media waiting indicator”
- “reconnect banner”
- “game finished summary”

## Read first

1. `client/AGENTS.md`
2. `docs/product/00-north-star.md`
3. `docs/specs/game-state-matrix.md`
4. `docs/specs/buzzer-state-machine.md` if answer/buzzer related
5. `server/docs/final-round-flow.md` if final round related
6. `server/docs/media-download-sync.md` if media readiness related

## Context7 requirement

Before frontend code changes, use Context7 for current Flutter/Dart docs and for docs of every touched third-party package. If Context7 is unavailable, state that and follow existing project code patterns instead of inventing APIs from memory.

## Files to inspect

Likely app areas:

- `client/apps/client/lib/src/features/game_lobby/**`
- `client/apps/client/lib/src/features/game_question/**`
- `client/apps/client/lib/src/features/game_lobby_final_review/**`
- generated models from `client/packages/openapi/`
- `client/apps/client/assets/localization/**`
- theme/UI helpers used nearby

For socket-driven UI, inspect the relevant `GameLobbyController` handlers before editing widgets.

## UX invariant

Gameplay UI is correct only when each affected role can answer:

- What phase are we in?
- What can I do now?
- Why can I not do this action?
- Is there a timer or media/reconnect wait?
- What just happened after my action?

Do not add a visible gameplay control without role/phase/disabled-reason behavior.

## Implementation steps

1. Identify affected phase(s) and role(s).
2. Check `docs/specs/game-state-matrix.md` and update it if behavior changes.
3. Inspect current controller state and generated DTOs before adding new state.
4. Prefer controller-owned state over widget-local hidden state for game flow.
5. Add UI with existing project patterns: `WatchingWidget`, `watchValue`, `getIt`, theme helpers, localization.
6. Add/adjust localization keys and regenerate when needed.
7. If server payload is insufficient, stop and update backend/OpenAPI/client generation instead of inventing client-only guesses.
8. Keep mobile/desktop behavior in mind, especially for buzzer/timers.
9. Add tests where practical or document manual scenario coverage.

## Buzzer-specific rules

For answer/buzzer UI, align with `docs/specs/buzzer-state-machine.md`.

Required considerations:

- Locked
- Ready
- PressedPending
- PressedAccepted
- Missed
- AlreadyAnswered
- Skipped
- NotEligible
- Spectator

Avoid duplicate action spam. Do not imply the user won the buzz before server confirmation.

## Localization

All user-facing copy should use localization keys. Good key groups:

- `game.states.*`
- `game.actions.*`
- `game.disabled_reasons.*`
- `game.feedback.*`
- `question.buzzer.*`
- `final.*`

Match existing JSON organization where possible.

## Common failure modes

- Hard-coded text in widgets.
- Button shown to spectators or wrong role.
- Disabled button without explanation.
- Client-only state that conflicts with server state after reconnect.
- Shortcut triggers while typing in a text input.
- Media starts before readiness rules are satisfied.
- Final round UI exposes hidden showman-only data to players.
- Generated model changed but `melos run gen_api`/`gen_files` not considered.

## Verification

From `client/`:

```bash
melos run analyze
```

If generated/localization inputs changed:

```bash
melos run gen_locale
melos run gen_files
melos run gen_api
```

Use the relevant subset. For broader changes:

```bash
melos run pre_build
melos run test
```

Manual scenario notes are valuable for gameplay UI. Include role/phase tested.

## Handoff checklist

Include:

- Context7 docs fetched or why unavailable
- phases/roles affected
- primary CTA and disabled reason changes
- localization/generation impact
- backend/OpenAPI impact, if any
- verification run
- manual scenario notes or gaps
