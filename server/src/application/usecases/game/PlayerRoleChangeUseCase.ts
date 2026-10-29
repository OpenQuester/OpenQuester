import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRoleChangeLogic } from "domain/logic/game/PlayerRoleChangeLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type PlayerRoleChangeBroadcastData,
  type PlayerRoleChangeInputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { GamePhase, getGamePhase, TransitionTrigger } from "domain/state-machine/types";
import { AnsweringPlayerLeaveLogic } from "domain/logic/player-leave/AnsweringPlayerLeaveLogic";

/**
 * Handles player role change requests.
 */
export class PlayerRoleChangeUseCase implements GameActionHandler<
  PlayerRoleChangeInputData,
  PlayerRoleChangeBroadcastData
> {
  constructor(
    private readonly validationService: SocketGameValidationService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {}

  public async execute(
    ctx: ActionExecutionContext<PlayerRoleChangeInputData>
  ): Promise<ActionHandlerResult<PlayerRoleChangeBroadcastData>> {
    GameValidator.validatePlayerAuthenticated(ctx);

    const { game, currentPlayer, action } = ctx;
    const { payload } = action;

    const targetPlayerId = payload.playerId ?? currentPlayer.meta.id;
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this.validationService.validatePlayerRoleChange(
      currentPlayer,
      targetPlayer,
      payload.newRole,
      game
    );

    const autoLoss =
      getGamePhase(game) === GamePhase.FINAL_MEDIA_DOWNLOADING &&
      targetPlayer.role === PlayerRole.PLAYER &&
      payload.newRole !== PlayerRole.PLAYER &&
      AnsweringPlayerLeaveLogic.processFinalRoundAutoLoss(game, targetPlayerId);
    const autoLossBroadcasts = AnsweringPlayerLeaveLogic.buildFinalRoundResult({
      game,
      userId: targetPlayerId,
      wasProcessed: autoLoss,
      transitionResult: null
    }).broadcasts;
    const mutation = PlayerRoleChangeLogic.processRoleChange(game, targetPlayer, payload.newRole);

    // Handle statistics based on role change
    if (payload.newRole === PlayerRole.PLAYER) {
      await this.playerGameStatsService.clearPlayerLeftAtTime(game.id, targetPlayerId);
    } else if (payload.newRole === PlayerRole.SPECTATOR && mutation.wasPlayer) {
      await this.playerGameStatsService.endPlayerSession(game.id, targetPlayerId, new Date());
    }

    const result = PlayerRoleChangeLogic.buildResult({ game, targetPlayer });

    const transition =
      getGamePhase(game) === GamePhase.FINAL_MEDIA_DOWNLOADING && !game.gameState.isPaused
        ? await this.phaseTransitionRouter.tryTransition({
            game,
            trigger: TransitionTrigger.CONDITION_MET,
            triggeredBy: { playerId: targetPlayerId, isSystem: false }
          })
        : null;

    const broadcastData: PlayerRoleChangeBroadcastData = {
      playerId: result.data.targetPlayer.meta.id,
      newRole: payload.newRole,
      players: result.data.players
    };

    return {
      success: true,
      data: broadcastData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromServiceBroadcasts(autoLossBroadcasts, game.id),
        ...DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts),
        ...DataMutationConverter.mutationFromTimerMutations(transition?.timerMutations),
        ...DataMutationConverter.mutationFromServiceBroadcasts(transition?.broadcasts, game.id)
      ]
    };
  }
}
