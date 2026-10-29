import { Game } from "domain/entities/game/Game";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";

/** Whether sequenced final content has finished on the authoritative phase timer. */
export class FinalContentLogic {
  public static isComplete(game: Game): boolean {
    const contentMs = game.gameState.finalRoundData?.questionData?.contentPlan?.totalMs ?? 0;
    if (contentMs <= 0) return true;
    const timer = game.gameState.timer;
    if (!timer) return false;
    const elapsed = game.gameState.isPaused
      ? (timer.elapsedMs ?? 0)
      : GamePauseLogic.calculateElapsedTime(timer);
    return elapsed >= contentMs;
  }
}
