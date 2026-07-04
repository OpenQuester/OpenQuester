# OpenQuester release plan and product gates

This document gives agents product priority context. It is intentionally high-level; detailed implementation behavior belongs in `docs/specs/`.

## Release strategy

Do not release OpenQuester as “almost works”. Release it when users feel that the game is clearer and more pleasant than SIGame for core flows.

The first strong release should prove:

- common SIGame-compatible gameplay works
- users understand what to do without repeated voice explanations
- package import/editor workflows do not silently damage content
- realtime gameplay is stable enough to trust

## Phase 0 — Freeze MVP scope

Goal: define “SIGame parity + better UX”.

Deliverables:

- SIQ compatibility matrix
- supported question-type list
- UX state matrix: phase × role × CTA × disabled reason × feedback
- release blockers
- load-test plan/report location
- package validation checklist

Relevant docs:

- `docs/specs/game-state-matrix.md`
- `docs/specs/siq-compatibility-matrix.md`
- `docs/specs/package-validation-spec.md`

## Phase 1 — Gameplay clarity MVP

Goal: new players understand the game without repeated voice explanation.

Must-have areas:

- global action panel or equivalent phase/CTA visibility
- buzzer states and false-start explanation
- success/fail answer button feedback
- phase indicator
- visible timers
- role-aware showman/player/spectator UI
- media waiting/reconnect banners
- disabled reasons for unavailable actions
- clear game end ceremony

Exit criteria:

- test games with new players produce few repeated confusion points
- showman does not explain “when to press” more than once
- disabled buttons explain why they are disabled
- reconnect returns users to a correct role-filtered state

## Phase 2 — Package/editor hardening

Goal: creators can import, create, validate, preview, and export packages without hidden failure.

Must-have areas:

- `.siq` import compatibility report
- unsupported feature accumulator
- package validation checklist
- package health / publish readiness
- media preview
- game-like question preview
- drag/reorder
- compression progress
- storage/upload preflight warnings

Relevant docs:

- `docs/specs/siq-compatibility-matrix.md`
- `docs/specs/package-validation-spec.md`
- `.agents/skills/package-editor-change/SKILL.md`

## Phase 3 — Stability gates

Goal: the game does not collapse under realistic users, reconnects, media, and storage usage.

Must-have gates:

- load-test report
- reconnect/disconnect scenario matrix
- media sync fallback/timeout behavior
- S3/object storage cleanup policy
- upload limits and preflight UX
- rate limits with user-facing feedback
- error IDs / bug report context
- admin diagnostics for game state/timer/queue/sockets

## Phase 4 — Closed alpha

Suggested audience:

- 5–10 friend groups
- 3–5 package creators
- 1–2 community/streamer groups

Useful metrics:

- confusion events per game
- reconnect failures
- media wait failures/timeouts
- package import failures
- time to create first simple package
- games completed without admin intervention
- repeat play within 7 days

## Phase 5 — Public beta

Focus after core stability:

- public package discovery
- favorites/recent packages
- package report/moderation flow
- feedback after game
- profile basics
- creator profile basics
- game summary/rematch/share card
- early community rituals

## Phase 6 — V1

V1 should feel like a real primary alternative, not “MVP finally done”.

Nice-to-have V1 areas:

- polished gameplay UX
- stable SIQ import for common packages
- usable editor
- featured packs manual program
- friends/favorites/profiles basics
- clear moderation
- documented hosted/self-host path
- public onboarding

## Keep out of MVP unless explicitly requested

- full team mode
- hostless mode
- native voice chat
- AI full package generation
- tournament system
- creator marketplace
- competitive ranked points

These are valid roadmap items. They should not delay the core goal: clear, stable, SIGame-compatible gameplay.

## Agent rule

When implementing a feature, classify it:

- `P0 MVP` — needed for core release strength or trust
- `P1 Beta` — valuable soon after MVP or for closed alpha/beta quality
- `P2 Post-release` — good roadmap fit, not a blocker
- `P3 Later` — large bet, experiment, or major product expansion

If a task asks for a P2/P3 feature, still implement it if requested, but do not reshape MVP architecture around it without an explicit product decision.
