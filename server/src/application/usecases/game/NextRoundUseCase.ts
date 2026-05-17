import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { type EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";

/**
 * Handles advancing to the next round.
 *
 * Flow:
 * 1. Validate showman role and game-in-progress state
 * 2. Fetch current question data (for statistics/finish broadcast)
 * 3. Clear active timer via mutation
 * 4. Execute round progression via round handler
 * 5. Delegate game progression broadcasting to coordinator
 */
export class NextRoundUseCase implements GameActionHandler<
  EmptyInputData,
  GameNextRoundEventPayload
> {
  constructor(
    private readonly packageStore: PackageStore,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameNextRoundEventPayload>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer } = ctx;

    if (currentPlayer.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_NEXT_ROUND);
    }

    GameStateValidator.validateGameInProgress(game);

    // Get current question data for statistics/finish broadcast
    const currentQuestionId = game.gameState.currentQuestion?.id ?? null;
    const questionData = currentQuestionId
      ? await this.packageStore.getQuestion(game.id, currentQuestionId)
      : null;

    // Build timer clear mutation (replaces direct gameService.clearTimer call)
    const timerClearMutation = this.socketGameTimerService.buildClearTimerMutation(game.id);

    // Execute round progression
    const roundHandler = RoundHandlerFactory.createFromGame(game);
    roundHandler.validateRoundProgression(game);

    // Get next round data
    const nextRoundEntry = game.getNextRound();
    let nextRoundData: GameStateRoundDTO | null;
    if (!nextRoundEntry) {
      nextRoundData = null;
    } else {
      nextRoundData = await this.packageStore.getRound(game.id, nextRoundEntry.order);
    }

    const { isGameFinished, nextGameState } = await roundHandler.handleRoundProgression(game, {
      forced: true,
      nextRound: nextRoundData
    });

    // Delegate game progression broadcasting to coordinator
    const progressionResult = await this.gameProgressionCoordinator.processGameProgression({
      game,
      isGameFinished,
      nextGameState,
      questionFinishData: questionData
        ? {
            answerFiles: questionData.answerFiles ?? null,
            answerText: questionData.answerText ?? null,
            nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null
          }
        : null
    });

    const mutations = [
      ...DataMutationConverter.mutationFromTimerMutations([timerClearMutation]),
      ...DataMutationConverter.mutationFromSocketBroadcasts(progressionResult.broadcasts)
    ];

    // Only save game if state actually changed
    if (isGameFinished || nextGameState) {
      mutations.unshift(DataMutationConverter.saveGameMutation(game));
    }

    return {
      success: progressionResult.success,
      data: progressionResult.data as GameNextRoundEventPayload,
      mutations,
      broadcastGame: game
    };
  }
}
