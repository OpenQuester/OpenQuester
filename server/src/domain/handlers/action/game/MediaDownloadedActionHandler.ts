import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";

/**
 * Stateless action handler for media downloaded notification.
 */
export class MediaDownloadedActionHandler
  implements
    GameActionHandler<EmptyInputData, MediaDownloadStatusBroadcastData>
{
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<MediaDownloadStatusBroadcastData>> {
    const { game, currentPlayer } = ctx;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    MediaDownloadLogic.markPlayerReady(currentPlayer);

    const allPlayersReady = MediaDownloadLogic.areAllPlayersReady(game);

    let transitionTimer = null;
    const transitionMutations: DataMutation[] = [];

    if (
      allPlayersReady &&
      game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
    ) {
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
      });

      if (transitionResult) {
        transitionTimer = transitionResult.timer ?? null;
        transitionMutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(
            transitionResult.timerMutations
          )
        );
      }
    }

    const result = MediaDownloadLogic.buildResult({
      game,
      playerId: currentPlayer.meta.id,
      allPlayersReady,
      timer: transitionTimer,
    });

    const statusData: MediaDownloadStatusBroadcastData = {
      playerId: result.data.playerId,
      mediaDownloaded: true,
      allPlayersReady: result.data.allPlayersReady,
      timer: result.data.timer,
    };

    return {
      success: true,
      data: statusData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...transitionMutations,
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}
