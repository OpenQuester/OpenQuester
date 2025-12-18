import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import {
  PlayerRestrictionBroadcastData,
  PlayerRestrictionInputData,
  PlayerRoleChangeBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for player restriction events (mute/restrict/ban)
 */
export class PlayerRestrictionEventHandler extends BaseSocketEventHandler<
  PlayerRestrictionInputData,
  PlayerRestrictionBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_RESTRICTED;
  }

  protected override async getGameIdForAction(
    _data: PlayerRestrictionInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
  }

  protected override getActionType(): GameActionType {
    return GameActionType.PLAYER_RESTRICTION;
  }

  protected async validateInput(
    data: PlayerRestrictionInputData
  ): Promise<PlayerRestrictionInputData> {
    return GameValidator.validatePlayerRestriction(data);
  }

  protected async authorize(
    _data: PlayerRestrictionInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: PlayerRestrictionInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerRestrictionBroadcastData>> {
    const result = await this.socketIOGameService.updatePlayerRestrictions(
      context.socketId,
      data.playerId,
      {
        muted: data.muted,
        restricted: data.restricted,
        banned: data.banned,
      }
    );

    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId: data.playerId,
      muted: data.muted,
      restricted: data.restricted,
      banned: data.banned,
    };

    // Using satisfies on each broadcast for type-safety while keeping array generic
    // (cleanup broadcasts from PlayerLeaveService have varied types)
    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.PLAYER_RESTRICTED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      } satisfies SocketEventBroadcast<PlayerRestrictionBroadcastData>,
    ];

    // If player was banned (removed), also emit LEAVE event
    if (result.wasRemoved) {
      broadcasts.push({
        event: SocketIOGameEvents.LEAVE,
        data: { user: data.playerId } satisfies GameLeaveEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      } satisfies SocketEventBroadcast<GameLeaveEventPayload>);
    }

    // If role was changed due to restriction, also emit role change event
    const roleChanged = !!result.newRole;
    if (roleChanged && result.newRole) {
      const roleChangeBroadcastData: PlayerRoleChangeBroadcastData = {
        playerId: data.playerId,
        newRole: result.newRole,
        players: result.game.players.map((p) => p.toDTO()),
      };

      broadcasts.push({
        event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
        data: roleChangeBroadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      } satisfies SocketEventBroadcast<PlayerRoleChangeBroadcastData>);
    }

    // Add game state cleanup broadcasts (e.g., turn change, bidding updates, media ready)
    // These come from PlayerLeaveService with various typed payloads
    if (result.gameStateCleanupBroadcasts) {
      for (const broadcast of result.gameStateCleanupBroadcasts) {
        broadcasts.push({
          event: broadcast.event,
          data: broadcast.data,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
          useRoleBasedBroadcast: broadcast.roleFilter,
        });
      }
    }

    return {
      success: true,
      data: broadcastData,
      broadcast: broadcasts,
    };
  }
}
