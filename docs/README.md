# OpenQuester documentation index

This directory contains product, architecture, agent workflow, and implementation specs.

## Agent-facing docs

- `../AGENTS.md` — repository-wide agent router.
- `agent/01-repo-map.md` — where to look before editing.
- `agent/02-source-of-truth.md` — priority order when docs disagree.
- `agent/03-verification-matrix.md` — commands/checks by task type.
- `agent/04-docs-drift-policy.md` — how to prevent stale instructions.

## Product docs

- `product/00-north-star.md` — product promise and decision lens.
- `product/01-release-plan.md` — release phases and what is/is not MVP.

## Specs

- `specs/game-state-matrix.md` — phase × role × CTA × disabled reason expectations.
- `specs/buzzer-state-machine.md` — answer/buzzer states and feedback requirements.
- `specs/siq-compatibility-matrix.md` — SIGame package import compatibility rules.
- `specs/package-validation-spec.md` — package health and publish-readiness rules.

## Architecture decisions

- `architecture/adr/0001-layered-server-architecture.md`
- `architecture/adr/0002-redis-game-action-queue.md`
- `architecture/adr/0003-realtime-gateway-port.md`

## Deep implementation docs

Server-specific deep docs remain in `server/docs/`, including:

- `server/docs/game-action-executor.md`
- `server/docs/how-to-add-socket-action.md`
- `server/docs/final-round-flow.md`
- `server/docs/media-download-sync.md`

Those docs are references for implementation details. Agent workflow and source-of-truth routing live here and in `.agents/skills/`.
