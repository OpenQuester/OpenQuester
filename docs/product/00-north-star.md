# OpenQuester Product North Star

This document is the product lens for agents. Use it before changing gameplay UX, package/editor flows, onboarding, community features, or release readiness docs.

## Product promise

OpenQuester is not just a SIGame clone with newer technologies. It should become a clearer, faster, more stable, and more creator-friendly quiz platform.

The product promise:

> A player, showman, or spectator should always understand what is happening, what they can do now, why something is unavailable, and why the result happened.

If a feature does not improve clarity, speed, stability, creator workflow, or the community/content loop, it is probably not an MVP priority.

## Competitive edge

SIGame has legacy content and familiarity. OpenQuester can win through:

- clearer realtime state
- easier room start and reconnect
- better role-aware UI
- honest buzzer feedback
- reliable media synchronization
- safer package import/validation
- modern editor and creator workflow
- community discovery and recognition after the core is stable

## Product principles

### 1. Make state visible

The game has a state machine. Users should not need to infer it from hidden rules or voice explanations.

Every gameplay phase should make these clear:

- current phase/state
- primary actor
- primary action
- disabled reason
- timer or waiting condition
- result feedback

### 2. One phase, one primary action

Bad UI shows many buttons and expects users to know which one matters. Good UI shows each role the action that matters now, while secondary controls are quieter.

For example:

- player: “Press when ready”, “Answer now”, “Waiting for showman”
- showman: “Choose question”, “Mark correct/wrong”, “Advance round”
- spectator: “Watching question”, “Player X is answering”

### 3. Fairness is UX

For realtime quiz/buzzer gameplay, stability is not merely technical quality. If media starts at different times, reconnect loses state, or button timing feels unclear, users experience the game as unfair.

Backend queueing, Redis locks, media readiness, reconnect snapshots, disabled reasons, and local feedback all support trust.

### 4. Creator workflow is a moat

The package editor and SIQ compatibility are strategic. More good packages create more reasons to return.

Creators should be able to:

- import `.siq` without silent corruption
- understand unsupported features
- validate package health
- preview how questions look in-game
- manage media without black-box failures
- save/export/publish with clear progress and errors

### 5. Polish follows clarity

Animations, gradients, sounds, and transitions are valuable only when they reinforce state. If motion or visual flair hides the current phase, active actor, or feedback, it is harmful.

## MVP product gates

Before public release, OpenQuester should feel like:

- SIGame-compatible enough for common packages and common gameplay.
- Easier to understand for new players.
- Stable under realistic realtime usage.
- Honest about unsupported package features.
- Safe enough for package upload/storage/reconnect scenarios.

## Non-goals for MVP

These are valuable but should not block core parity + clarity unless explicitly prioritized:

- full team mode
- hostless mode
- native voice chat
- AI full package generation
- tournament system
- creator marketplace
- competitive ranked points

## Agent checklist for product-sensitive changes

Before finishing a gameplay/editor UX task, answer:

- Which user role benefits?
- Which phase/state changed?
- What is the primary CTA?
- What is the disabled reason?
- What feedback appears after action/failure?
- Is this MVP/Beta/Later according to `docs/product/01-release-plan.md`?
- Does the relevant spec need updating?

If the answer is unclear, the implementation is probably not ready.
