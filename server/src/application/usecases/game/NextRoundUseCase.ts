import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { FINAL_ROUND_THEME_ELIMINATION_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { type Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import {
  type ActionExecutionContext,
  type TimerMutation
} from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { type GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { type EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Handles advancing to the next round.
 *
 * Flow:
 * 1. Validate showman role and game-in-progress state
 * 2. Fetch current question data (for statistics/finish broadcast)
 * 3. Execute round progression via round handler
 * 4. Rebuild timer mutations for the next round
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

    const timerMutations = this.buildNextRoundTimerMutations(
      game,
      nextRoundData,
      nextGameState
    );

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
      ...DataMutationConverter.mutationFromTimerMutations(timerMutations),
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

  private buildNextRoundTimerMutations(
    game: Game,
    nextRoundData: GameStateRoundDTO | null,
    nextGameState: GameStateDTO | null
  ): TimerMutation[] {
    const timerMutations = [
      this.socketGameTimerService.buildClearTimerMutation(game.id)
    ];

    const shouldStartThemeEliminationTimer =
      !!nextGameState && nextRoundData?.type === PackageRoundType.FINAL;

    if (!shouldStartThemeEliminationTimer) {
      return timerMutations;
    }

    const themeEliminationTimer = new GameStateTimer(
      FINAL_ROUND_THEME_ELIMINATION_TIME
    ).start();

    nextGameState.timer = themeEliminationTimer;
    game.gameState.timer = themeEliminationTimer;
    timerMutations.push({
      op: "set",
      key: timerKey(game.id),
      value: JSON.stringify(themeEliminationTimer),
      pxTtl: FINAL_ROUND_THEME_ELIMINATION_TIME
    });

    return timerMutations;
  }
}
