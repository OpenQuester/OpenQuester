import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Handles media downloaded notification from a player.
 * Marks player as ready and transitions to showing phase when all players are ready.
 */
export class MediaDownloadedUseCase
  implements
    GameActionHandler<EmptyInputData, MediaDownloadStatusBroadcastData>
{
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<MediaDownloadStatusBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer } = ctx;

    currentPlayer.mediaDownloaded = true;

    const allPlayersReady = MediaDownloadLogic.areAllPlayersReady(game);

    let transitionTimer = null;
    const transitionTimerMutations: DataMutation[] = [];
    const transitionRevealMutations: DataMutation[] = [];

    if (
      allPlayersReady &&
      game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
    ) {
      // Transition to showing question if all players are ready
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
        resources: await this.transitionResourceService.getCurrentQuestionWithTheme(game),
      });

      if (transitionResult) {
        transitionTimer = transitionResult.timer ?? null;
        transitionTimerMutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(
            transitionResult.timerMutations
          )
        );
        transitionRevealMutations.push(
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
      allPlayersReady,
      timer: transitionTimer,
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
        ...transitionTimerMutations,
        ...DataMutationConverter.mutationFromSocketBroadcasts([broadcast]),
        ...transitionRevealMutations
      ]
    };
  }
}
