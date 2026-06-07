# How To Add Game Logic

Game logic should be easy to test without booting Express, Socket.IO, Redis, or PostgreSQL. Put rules in `domain/`; put orchestration and I/O in `application/`.

## Choose The Right Place

| Logic type | Good location |
| --- | --- |
| Entity state change | `src/domain/entities/` when it belongs to the entity |
| Reusable rule or calculation | `src/domain/logic/` |
| Input or state validation | `src/domain/validators/` |
| Phase transition | `src/domain/state-machine/` |
| DTO conversion | `src/domain/mappers/` |
| Workflow with I/O | `src/application/usecases/` or `src/application/services/` |

## Domain Logic Rules

- Keep functions deterministic when possible.
- Pass required data as arguments instead of resolving dependencies inside domain logic.
- Throw `ClientError` for rule violations that should be shown to the client.
- Return typed result objects when the caller needs broadcasts, timers, or next-state data.
- Do not perform Redis, database, storage, or Socket.IO operations from domain logic.

## Use Case Rules

- Load or receive all required context before calling domain logic.
- Let domain logic validate and mutate the in-memory `Game` entity.
- Convert side effects into `DataMutation[]`.
- Keep external writes after domain decisions, normally through `DataMutationProcessor`.
- Keep transport-only behavior out of use cases.

## State Machine Changes

Use `src/domain/state-machine/` when the change moves the game between phases.

1. Add or update a `TransitionHandler` for the relevant phase.
2. Keep `canTransition()` focused on whether the transition applies.
3. Keep `execute()` focused on applying the transition and returning transition output.
4. Register new handlers through the existing phase transition router creation flow.
5. Add tests or scenario coverage for the phase before, trigger, and resulting phase.

## Example Split

Use this split for a new rule like “player can answer only once”:

- `domain/logic/question/AnswerSubmittedLogic.ts`: checks whether the answer can be accepted and applies the in-memory change.
- `application/usecases/question/AnswerSubmittedUseCase.ts`: receives action context, calls domain logic, returns save and broadcast mutations.
- `presentation/controllers/io/SocketActionMap.ts`: maps the socket event to the action type and validator.

## Checklist

- The rule can be tested without a server process.
- The use case owns I/O coordination, not rule decisions.
- Game state changes happen on domain entities or domain logic.
- Persistence and broadcasts are declared through mutations.
- Existing state-machine docs are updated when phase behavior changes.

## Related Docs

- `final-round-flow.md`
- `game-action-executor.md`
- `media-download-sync.md`
