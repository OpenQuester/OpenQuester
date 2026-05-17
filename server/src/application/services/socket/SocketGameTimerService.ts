import { singleton } from "tsyringe";

import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { SECOND_MS } from "domain/constants/time";
import { Game } from "domain/entities/game/Game";
import { GamePauseLogic, GamePauseResult } from "domain/logic/timer/GamePauseLogic";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

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
      // Clear saved timer
      mutations.push({
        op: "delete",
        key: timerKey(game.id, questionState!)
      });
      // Update timer with resumedAt timestamp
      GamePauseLogic.updateTimerForResume(savedTimer);
      // Set active timer with remaining time
      const remainingMs = GamePauseLogic.calculateRemainingTime(savedTimer);
      mutations.push({
        op: "set",
        key: timerKey(game.id),
        value: JSON.stringify(savedTimer),
        pxTtl: remainingMs
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
