---
name: docs-upkeep
description: Use when changing docs, skills, AGENTS files, specs, ADRs, source-of-truth routing, or when code changes make existing docs stale.
---

# Docs upkeep skill

Use this skill when creating, changing, removing, or collapsing project documentation, or when implementation work changes behavior that docs describe.

## Read first

1. `docs/agent/02-source-of-truth.md`
2. `docs/agent/04-docs-drift-policy.md`
3. `AGENTS.md`
4. nearest scoped `AGENTS.md` for the affected area

## Documentation maintenance rule

Documentation is part of implementation. If a task changes architecture, workflows, commands, public contracts, game behavior, generated-code flow, validation structure, or product decisions, update the related docs in the same task when practical.

Do not wait for a periodic docs cleanup if the current task made a doc stale.

## When to update docs

Update docs when changing:

- architecture boundaries
- public REST or Socket.IO contracts
- generated-code workflow
- game state/role/CTA behavior
- package/SIQ validation or compatibility behavior
- validation commands or structure
- Redis/cache strategy, runtime events, or release gates when they affect agent workflow
- product priority or release strategy

## When to add a new doc or skill

Add a doc/skill when:

- a workflow is repeated and high-risk
- existing docs are too broad to guide implementation
- a new subsystem needs persistent decisions
- agents keep making the same mistake

Do not add a new doc just because a small feature was implemented. Prefer updating an existing spec or skill.

## When to remove or collapse docs

Remove or collapse docs when they are stale, misleading, duplicated, no longer relevant after a release phase, or replaced by a better source of truth.

When removing docs, update all links that pointed to them.

## Handoff checklist

Report docs added/changed/removed, stale docs fixed, source-of-truth links updated, commands or workflows changed, and docs intentionally not updated with reason.
