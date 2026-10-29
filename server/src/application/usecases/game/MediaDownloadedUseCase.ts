import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter, type DataMutation } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type MediaDownloadedInputData } from "domain/types/socket/events/game/MediaDownloadedInputData";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { GameValidator } from "domain/validators/GameValidator";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";

/**
 * Handles media downloaded notification from a player.
 * Marks player as ready and transitions to showing phase when all players are ready.
 */
export class MediaDownloadedUseCase implements GameActionHandler<
  MediaDownloadedInputData,
  MediaDownloadStatusBroadcastData
> {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public async execute(
    ctx: ActionExecutionContext<MediaDownloadedInputData>
  ): Promise<ActionHandlerResult<MediaDownloadStatusBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer } = ctx;

    if (game.gameState.questionState !== QuestionState.MEDIA_DOWNLOADING) {
      return { success: true, mutations: [] };
    }

    // A player who joined after the pick cannot affect readiness or report durations.
    if (
      currentPlayer.role === PlayerRole.PLAYER &&
      !game.isPlayerEligibleForMedia(currentPlayer.meta.id)
    ) {
      return { success: true, mutations: [] };
    }

    const isFinal = game.gameState.currentRound?.type === PackageRoundType.FINAL;
    const preparationId = game.gameState.finalRoundData?.questionData?.mediaPreparationId;
    if (
      isFinal &&
      (currentPlayer.role !== PlayerRole.PLAYER ||
        currentPlayer.gameStatus !== PlayerGameStatus.IN_GAME ||
        !preparationId ||
        ctx.action.payload?.mediaPreparationId !== preparationId)
    ) {
      return { success: true, mutations: [] };
    }

    currentPlayer.mediaDownloaded = true;
    if (!isFinal)
      QuestionContentPlanLogic.mergeMediaDurations(game, ctx.action.payload?.mediaDurations);

    const allPlayersReady = MediaDownloadLogic.areAllPlayersReady(game);

    let transitionTimer = null;
    const transitionMutations: DataMutation[] = [];

    if (allPlayersReady && (!isFinal || !game.gameState.isPaused)) {
      // Transition to showing question if all players are ready
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false }
      });

      if (transitionResult) {
        transitionTimer = transitionResult.timer ?? null;
        transitionMutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(transitionResult.timerMutations)
        );
        if (isFinal)
          transitionMutations.push(
            ...DataMutationConverter.mutationFromServiceBroadcasts(
              transitionResult.broadcasts,
              game.id
            )
          );
      }
    }

    const statusData: MediaDownloadStatusBroadcastData = {
      playerId: currentPlayer.meta.id,
      mediaDownloaded: true,
      allPlayersReady: isFinal ? false : allPlayersReady,
      timer: transitionTimer,
      contentPlan: transitionTimer ? (game.gameState.questionContentPlan ?? null) : undefined,
      buzzerOpensAtMs: transitionTimer ? (game.gameState.buzzerOpensAtMs ?? null) : undefined
    };

    const broadcast: SocketEventBroadcast<MediaDownloadStatusBroadcastData> = {
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      data: statusData,
      target: SocketBroadcastTarget.GAME,
      gameId: game.id
    };

    return {
      success: true,
      data: statusData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...transitionMutations,
        ...(!isFinal || !transitionTimer
          ? DataMutationConverter.mutationFromSocketBroadcasts([broadcast])
          : [])
      ]
    };
  }
}
