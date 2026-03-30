import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AnsweringLeaveStrategy } from "domain/logic/player-leave/strategies/AnsweringLeaveStrategy";
import { FinalBiddingLeaveStrategy } from "domain/logic/player-leave/strategies/FinalBiddingLeaveStrategy";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { MediaDownloadLeaveStrategy } from "domain/logic/player-leave/strategies/MediaDownloadLeaveStrategy";
import { StakeBiddingLeaveStrategy } from "domain/logic/player-leave/strategies/StakeBiddingLeaveStrategy";
import { TurnPlayerLeaveStrategy } from "domain/logic/player-leave/strategies/TurnPlayerLeaveStrategy";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { PlayerKickBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

export enum PlayerLeaveReason {
  DISCONNECT = "disconnect",
  LEAVE = "leave",
  KICK = "kick",
  BAN = "ban",
}

export interface PlayerLeaveOptions {
  reason: PlayerLeaveReason;
}

@singleton()
export class PlayerLeaveOrchestrator {
  private readonly strategies: IPlayerLeaveStrategy[];

  constructor(
    private readonly stakeBiddingStrategy: StakeBiddingLeaveStrategy,
    private readonly finalBiddingStrategy: FinalBiddingLeaveStrategy,
    private readonly answeringStrategy: AnsweringLeaveStrategy,
    private readonly turnPlayerStrategy: TurnPlayerLeaveStrategy,
    private readonly mediaDownloadStrategy: MediaDownloadLeaveStrategy
  ) {
    this.strategies = [
      this.stakeBiddingStrategy,
      this.finalBiddingStrategy,
      this.answeringStrategy,
      this.turnPlayerStrategy,
      this.mediaDownloadStrategy,
    ];
  }

  public async processLeave(
    game: Game,
    userId: number,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveStrategyResult> {
    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    // Execute strategies BEFORE removing player
    for (const strategy of this.strategies) {
      // MediaDownloadLeaveStrategy must be executed AFTER removing player
      if (strategy instanceof MediaDownloadLeaveStrategy) {
        continue;
      }

      if (strategy.canHandle(game, userId)) {
        const strategyResult = await strategy.execute(game, userId);
        result.mutations.push(...strategyResult.mutations);
        result.broadcasts.push(...strategyResult.broadcasts);
      }
    }

    // Remove player from game
    game.removePlayer(userId);

    // Remove from ready list
    if (game.gameState.readyPlayers) {
      game.gameState.readyPlayers = game.gameState.readyPlayers.filter(
        (playerId) => playerId !== userId
      );
    }

    // Execute MediaDownloadLeaveStrategy AFTER removing player
    const mediaDownloadStrategy = this.strategies.find(
      (s) => s instanceof MediaDownloadLeaveStrategy
    );
    if (mediaDownloadStrategy?.canHandle(game, userId)) {
      const strategyResult = await mediaDownloadStrategy.execute(game, userId);
      result.mutations.push(...strategyResult.mutations);
      result.broadcasts.push(...strategyResult.broadcasts);
    }

    // Build broadcasts based on reason
    switch (options.reason) {
      case PlayerLeaveReason.KICK:
        result.broadcasts.push({
          event: SocketIOGameEvents.PLAYER_KICKED,
          data: { playerId: userId } satisfies PlayerKickBroadcastData,
          room: game.id,
        });
        result.broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: game.id,
        });
        break;

      case PlayerLeaveReason.BAN:
        // BAN broadcasts are handled by
        // PlayerRestrictionLogic.buildBanResult() in the action handler
        break;

      case PlayerLeaveReason.LEAVE:
      case PlayerLeaveReason.DISCONNECT:
        result.broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: game.id,
        });
        break;
    }

    return result;
  }

  public async processGameStateCleanup(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    for (const strategy of this.strategies) {
      if (strategy.canHandle(game, userId)) {
        const strategyResult = await strategy.execute(game, userId);
        result.mutations.push(...strategyResult.mutations);
        result.broadcasts.push(...strategyResult.broadcasts);
      }
    }

    return result;
  }
}
