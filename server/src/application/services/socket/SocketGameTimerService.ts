import { singleton } from "tsyringe";

import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { SECOND_MS } from "domain/constants/time";
import { Game } from "domain/entities/game/Game";
import { GamePauseLogic, GamePauseResult } from "domain/logic/timer/GamePauseLogic";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Service for managing game timer pause/resume operations.
 */
@singleton()
export class SocketGameTimerService {
  constructor() {
    //
  }

  // ──────────────────────────────────────────────────────────────
  //  Mutation builders for context-aware handlers (Phase 2)
  //
  //  These return TimerMutation objects instead of making Redis
  //  calls directly. The executor batches them in the OUT pipeline.
  // ──────────────────────────────────────────────────────────────

  /**
   * Build a mutation to save the current timer with updated elapsed time.
   * Pure equivalent of `saveElapsedTimer()` — mutates the timer DTO in-memory
   * and returns a SET mutation for the OUT pipeline.
   */
  public buildSaveElapsedTimerMutation(
    game: Game,
    expireTimeMs: number,
    questionState: QuestionState
  ): TimerMutation {
    const elapsedTimer = game.gameState.timer!;
    GamePauseLogic.updateTimerForPause(elapsedTimer);

    return {
      op: "set",
      key: timerKey(game.id, questionState),
      value: JSON.stringify(elapsedTimer),
      pxTtl: Math.ceil(expireTimeMs * 1.5)
    };
  }

  /**
   * Build mutations for pausing the game timer.
   * Pure equivalent of `pauseGameTimer()` — mutates game in-memory
   * and returns timer mutations for the OUT pipeline.
   *
   * @param game Game entity (will be mutated: pause + clear timer)
   * @param activeTimer Active timer from context (from IN pipeline GET)
   * @returns Pause result with broadcasts + timer mutations to flush
   */
  public buildPauseTimerMutations(
    game: Game,
    activeTimer: GameStateTimerDTO | null
  ): { result: GamePauseResult; timerMutations: TimerMutation[] } {
    // A key may expire just before the pause action takes the game lock.
    // Preserve that phase clock so unpause can rearm its pending expiration.
    activeTimer ??= game.gameState.questionTransition ? game.gameState.timer : null;
    const questionState = game.gameState.questionState;
    const mutations: TimerMutation[] = [];

    if (activeTimer) {
      GamePauseLogic.updateTimerForPause(activeTimer);
      // Save timer with elapsed time under questionState suffix
      mutations.push({
        op: "set",
        key: timerKey(game.id, questionState!),
        value: JSON.stringify(activeTimer),
        pxTtl: Math.ceil(GAME_TTL_IN_SECONDS * SECOND_MS * 1.25)
      });
      // Clear active timer to avoid expiration
      mutations.push({
        op: "delete",
        key: timerKey(game.id)
      });
    }

    const opening = game.gameState.questionTransition;
    if (opening && !game.gameState.isPaused) {
      GamePauseLogic.updateTimerForPause(opening.timer);
      mutations.push({ op: "delete", key: questionTransitionTimerKey(game.id) });
    }

    game.pause();
    game.setTimer(null);

    const result = GamePauseLogic.buildResult({
      game,
      timer: activeTimer,
      isPause: true
    });

    return { result, timerMutations: mutations };
  }

  /**
   * Build mutations for unpausing the game timer.
   * Pure equivalent of `unpauseGameTimer()` — mutates game in-memory
   * and returns timer mutations for the OUT pipeline.
   *
   * @param game Game entity (will be mutated: unpause + set timer)
   * @param savedTimer Saved/paused timer loaded separately (from GET timer:{questionState}:{gameId})
   * @returns Unpause result with broadcasts + timer mutations to flush
   */
  public buildUnpauseTimerMutations(
    game: Game,
    savedTimer: GameStateTimerDTO | null
  ): { result: GamePauseResult; timerMutations: TimerMutation[] } {
    const questionState = game.gameState.questionState;
    const mutations: TimerMutation[] = [];

    if (savedTimer) {
      const finalData = game.gameState.finalRoundData;
      const contentMs = finalData?.questionData?.contentPlan?.totalMs;
      // If everyone has already answered, finish when the final content ends.
      if (
        questionState === QuestionState.ANSWERING &&
        finalData?.phase === FinalRoundPhase.ANSWERING &&
        contentMs != null &&
        FinalRoundStateManager.areAllAnswersSubmitted(game)
      ) {
        // Redis needs a positive TTL, even when the content has no blocking duration.
        savedTimer.durationMs = Math.max(1, Math.min(savedTimer.durationMs, contentMs));
      }
      // Clear saved timer
      mutations.push({
        op: "delete",
        key: timerKey(game.id, questionState!)
      });
      // Update timer with resumedAt timestamp
      const now = Date.now();
      GamePauseLogic.updateTimerForResume(savedTimer, game.gameState.pausedAt, now);
      // Set active timer with remaining time
      const remainingMs = GamePauseLogic.calculateRemainingTime(savedTimer, now);
      mutations.push({
        op: "set",
        key: timerKey(game.id),
        value: JSON.stringify(savedTimer),
        pxTtl: remainingMs
      });
    }

    const opening = game.gameState.questionTransition;
    if (opening) {
      GamePauseLogic.updateTimerForResume(opening.timer, game.gameState.pausedAt);
      mutations.push({
        op: "set",
        key: questionTransitionTimerKey(game.id),
        value: JSON.stringify(opening.timer),
        pxTtl: GamePauseLogic.calculateRemainingTime(opening.timer)
      });
    }

    game.unpause();
    game.setTimer(savedTimer);

    const result = GamePauseLogic.buildResult({
      game,
      timer: savedTimer,
      isPause: false
    });

    return { result, timerMutations: mutations };
  }

  /**
   * Build a mutation to clear the active timer.
   * Pure equivalent of `gameService.clearTimer(gameId)`.
   */
  public buildClearTimerMutation(gameId: string, timerAdditional?: string): TimerMutation {
    return {
      op: "delete",
      key: timerKey(gameId, timerAdditional)
    };
  }
}
