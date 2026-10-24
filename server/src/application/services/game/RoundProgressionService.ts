import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { FINAL_ROUND_THEME_ELIMINATION_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { type Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { type GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Ends the current round and moves the game on: to the next round, the
 * final round, or the end of the game. Used by the showman's next-round
 * action and when a pick finds the round's time already up.
 */
export class RoundProgressionService {
  constructor(
    private readonly packageStore: PackageStore,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {
    //
  }

  public async advanceRound(game: Game): Promise<ActionHandlerResult<GameNextRoundEventPayload>> {
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
            nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
            answerContentPlan: ShowAnswerLogic.buildAnswerPlan(questionData),
            ...ShowAnswerLogic.revealDetails(questionData)
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
