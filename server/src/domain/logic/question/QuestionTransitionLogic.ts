import { QUESTION_TRANSITION_MS, QUESTION_TRANSITION_FADE_OUT_MS } from "domain/constants/game";
import { questionTransitionTimerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { TimerMutation } from "domain/types/action/ActionExecutionContext";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

/** Pure rules shared by ACKs, expiration, roster changes and pause/resume. */
export class QuestionTransitionLogic {
  public static start(game: Game): TimerMutation {
    const timer = new GameStateTimer(QUESTION_TRANSITION_MS).start();
    game.gameState.questionTransition = { timer, mediaReady: !this.hasMedia(game) };
    if (game.gameState.questionTransition.mediaReady) QuestionContentPlanLogic.applyToGame(game);
    return this.timerMutation(game);
  }

  public static hasMedia(game: Game): boolean {
    return !!game.gameState.currentQuestion?.questionFiles?.length;
  }

  public static mediaReady(game: Game): boolean {
    if (!this.hasMedia(game) || game.gameState.questionTransition?.timedOut) return true;
    // In a solo rehearsal the showman is the viewer. An empty player roster
    // must not start a short clip before that viewer finishes preloading it.
    if (game.getMediaEligiblePlayerIds()?.length === 0) {
      return game.players.some(
        (p) =>
          p.role === PlayerRole.SHOWMAN &&
          p.gameStatus === PlayerGameStatus.IN_GAME &&
          p.mediaDownloaded
      );
    }
    return MediaDownloadLogic.areAllPlayersReady(game);
  }

  public static elapsed(game: Game, now = Date.now()): number {
    const timer = game.gameState.questionTransition!.timer;
    return game.gameState.isPaused
      ? timer.elapsedMs
      : GamePauseLogic.calculateElapsedTime(timer, now);
  }

  public static canShow(game: Game, now = Date.now()): boolean {
    const opening = game.gameState.questionTransition;
    return (
      !!opening &&
      !game.gameState.isPaused &&
      opening.mediaReady &&
      this.mediaReady(game) &&
      this.elapsed(game, now) >= opening.timer.durationMs
    );
  }

  /** Only a new readiness edge may extend the final fade; duplicate ACKs cannot. */
  public static refresh(game: Game, forceReady = false): TimerMutation[] {
    const opening = game.gameState.questionTransition;
    if (!opening || game.gameState.questionState !== QuestionState.MEDIA_DOWNLOADING) return [];
    if (forceReady) {
      opening.timedOut = true;
      MediaDownloadLogic.forceAllPlayersReady(game);
    }
    const ready = this.mediaReady(game);
    if (ready === opening.mediaReady) return [];
    opening.mediaReady = ready;
    if (!ready) return [];
    QuestionContentPlanLogic.applyToGame(game);
    opening.timer.durationMs = Math.max(
      opening.timer.durationMs,
      this.elapsed(game) + QUESTION_TRANSITION_FADE_OUT_MS
    );
    return game.gameState.isPaused ? [] : [this.timerMutation(game)];
  }

  public static timerMutation(game: Game): TimerMutation {
    const opening = game.gameState.questionTransition!;
    return {
      op: "set",
      key: questionTransitionTimerKey(game.id),
      value: JSON.stringify(opening.timer),
      pxTtl: Math.max(1, Math.ceil(opening.timer.durationMs - this.elapsed(game)))
    };
  }

  public static status(
    game: Game,
    playerId: number,
    timer: GameStateTimerDTO | null
  ): MediaDownloadStatusBroadcastData {
    return {
      playerId,
      mediaDownloaded: true,
      allPlayersReady:
        timer != null ||
        (game.gameState.questionTransition?.mediaReady ??
          MediaDownloadLogic.areAllPlayersReady(game)),
      timer,
      questionTransition: game.gameState.questionTransition ?? null,
      contentPlan: game.gameState.questionContentPlan ?? null,
      buzzerOpensAtMs: game.gameState.buzzerOpensAtMs ?? null
    };
  }
}
