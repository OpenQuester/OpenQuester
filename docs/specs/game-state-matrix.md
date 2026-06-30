# Game state matrix

This spec helps agents keep gameplay UI and backend state changes aligned. Update it whenever a phase, role permission, CTA, disabled reason, timer, or user-facing state changes.

## Core rule

For every visible game phase, each role should know:

- what is happening
- what they can do
- why they cannot do something
- what timer/wait condition matters
- what feedback confirms the result

## Roles

| Role | Meaning |
|---|---|
| Showman | Host/controller. Chooses questions, controls flow, marks answers, manages lobby/game. |
| Player | Competes, buzzes/answers, bids, eliminates final themes, sees role-specific prompts. |
| Spectator | Watches game state without gameplay actions. Should still understand what is happening. |

## High-level phases

Names in code may differ. Use nearby enums/types as the implementation source of truth, but preserve this product behavior.

| Phase | Showman primary CTA | Player primary CTA | Spectator primary CTA | Disabled reason examples | Feedback |
|---|---|---|---|---|---|
| Lobby | Configure/start game | Ready/unready, choose slot/role if allowed | Join/watch | “Waiting for players”, “Only showman can start”, “Package missing” | ready state, role badges, copied link toast |
| Choosing | Choose theme/question | Waiting for question choice | Watching choice | “Only showman/current player can choose”, “Question already played” | chosen cell highlight, phase transition |
| Showing question | Continue/watch media readiness | Wait until buzzer ready or media loaded | Watching question | “Button locked until question/media is ready”, “You joined after question started” | media readiness indicators, timer visible |
| Ready to buzz | Observe/prepare to judge | Press buzzer | Watching who buzzes | “You already answered”, “You are skipped”, “Spectators cannot answer” | Ready state, keyboard hint, pulse/sound when active |
| Answering | Mark correct/wrong/skip | Answer if selected, otherwise wait | Watching active answerer | “Another player is answering” | active player highlight, answer prompt |
| Reviewing answer | Correct/wrong/score result | Waiting for showman decision | Watching review | “Only showman can mark answer” | score delta, correct/wrong result, next phase |
| Between questions | Pick next / next round | Waiting | Watching | “Round is not ready”, “Game paused” | phase label, next action visible |
| Final theme elimination | Eliminate for current player / observe | Eliminate if it is your turn | Watching elimination | “Not your turn”, “Theme already eliminated” | eliminated theme animation, next player indicator |
| Final bidding | Observe / proceed when bids complete | Submit bid if eligible | Watching bids | “Bid already submitted”, “Insufficient score”, “Spectators cannot bid” | bid submitted state, timer, all-bids-ready state |
| Final answering | Wait/review later | Submit final answer | Watching answer phase | “You did not bid”, “Answer already submitted”, “Timer expired” | submitted state, remaining time |
| Final reviewing | Review each answer | Waiting for review | Watching review | “Only showman can review” | per-answer correct/wrong, final score updates |
| Finished | Start/rematch/share/admin actions | See results/rematch/share | See results | “Game already finished” | winner, podium, summary, score deltas |
| Paused/reconnecting | Resume or wait | Reconnecting/waiting | Reconnecting/waiting | “Game paused”, “Connection lost” | reconnect banner, restored state |

## Required frontend behavior

When changing gameplay UI, make sure the affected phase has:

1. Role-aware primary action.
2. Clear disabled reason for unavailable actions.
3. Visible timer or waiting condition.
4. Immediate local feedback for user actions when safe.
5. Server-confirmed feedback when authoritative result arrives.
6. Mobile and desktop input affordance if the action is time-sensitive.
7. Localization keys for user-facing text.

## Required backend behavior

When changing gameplay state, make sure:

1. Game-changing actions go through the queued `GameActionExecutor` path.
2. Domain rules live in `domain/` when reusable or non-trivial.
3. Use cases return declared mutations instead of hidden writes/emits.
4. Broadcast payloads let the frontend distinguish role/phase/disabled states.
5. New public event/payload changes are reflected in `openapi/schema.json`.
6. Tests cover invalid roles, invalid phases, and race-sensitive behavior when applicable.

## Common disabled reason categories

Use consistent categories in UI copy and server/client logic:

- `wrong_role` — this role cannot perform the action.
- `wrong_phase` — action is valid in another phase only.
- `not_your_turn` — action belongs to another player/showman.
- `already_done` — user already answered/bid/readied/skipped.
- `not_eligible` — joined late, eliminated, insufficient score, muted/restricted, etc.
- `waiting_for_media` — media readiness has not completed.
- `waiting_for_server` — local action submitted, server confirmation pending.
- `rate_limited` — too many actions too quickly.
- `connection_lost` — socket/session is reconnecting.

## Agent update checklist

Update this spec when:

- adding a new phase/state
- changing role permissions
- changing answer/buzzer behavior
- changing final round behavior
- changing media waiting/reconnect behavior
- adding user-facing disabled reasons
- changing game-finished summary behavior

Do not update this matrix for purely internal refactors that do not affect visible state.
