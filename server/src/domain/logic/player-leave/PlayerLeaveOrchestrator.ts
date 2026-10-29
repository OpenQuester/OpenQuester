import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AnsweringLeaveStrategy } from "domain/logic/player-leave/strategies/AnsweringLeaveStrategy";
import { EveryoneAnswersLeaveStrategy } from "domain/logic/player-leave/strategies/EveryoneAnswersLeaveStrategy";
import { FinalBiddingLeaveStrategy } from "domain/logic/player-leave/strategies/FinalBiddingLeaveStrategy";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult,
  StakeBiddingLeaveInput
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { MediaDownloadLeaveStrategy } from "domain/logic/player-leave/strategies/MediaDownloadLeaveStrategy";
import { StakeBiddingLeaveStrategy } from "domain/logic/player-leave/strategies/StakeBiddingLeaveStrategy";
import { TurnPlayerLeaveStrategy } from "domain/logic/player-leave/strategies/TurnPlayerLeaveStrategy";
import { type TransitionResources } from "domain/state-machine/types";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { PlayerKickBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

export enum PlayerLeaveReason {
  DISCONNECT = "disconnect",
  LEAVE = "leave",
  KICK = "kick",
  BAN = "ban"
}

export interface PlayerLeaveOptions {
  reason: PlayerLeaveReason;
  stakeBidding?: StakeBiddingLeaveInput;
  transitionResources?: TransitionResources;
}

export interface PlayerLeaveCleanupOptions {
  stakeBidding?: StakeBiddingLeaveInput;
  transitionResources?: TransitionResources;
}

@singleton()
export class PlayerLeaveOrchestrator {
  private readonly strategies: IPlayerLeaveStrategy[];
  /** Strategies that react to the player being gone, so they run after removal */
  private readonly afterRemovalStrategies: IPlayerLeaveStrategy[];

  constructor(
    private readonly stakeBiddingStrategy: StakeBiddingLeaveStrategy,
    private readonly finalBiddingStrategy: FinalBiddingLeaveStrategy,
    private readonly answeringStrategy: AnsweringLeaveStrategy,
    private readonly turnPlayerStrategy: TurnPlayerLeaveStrategy,
    private readonly mediaDownloadStrategy: MediaDownloadLeaveStrategy,
    private readonly everyoneAnswersStrategy: EveryoneAnswersLeaveStrategy
  ) {
    this.strategies = [
      this.stakeBiddingStrategy,
      this.finalBiddingStrategy,
      this.answeringStrategy,
      this.turnPlayerStrategy,
      this.mediaDownloadStrategy,
      this.everyoneAnswersStrategy
    ];
    this.afterRemovalStrategies = [this.mediaDownloadStrategy, this.everyoneAnswersStrategy];
  }

  public async processLeave(
    game: Game,
    userId: number,
    options: PlayerLeaveOptions
  ): Promise<PlayerLeaveStrategyResult> {
    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: []
    };
    const strategyInput: PlayerLeaveStrategyInput = {
      game,
      userId,
      stakeBidding: options.stakeBidding,
      transitionResources: options.transitionResources
    };

    // Execute strategies BEFORE removing player
    for (const strategy of this.strategies) {
      if (this.afterRemovalStrategies.includes(strategy)) {
        continue;
      }

      // A disconnected finalist can rejoin before answering starts without losing the bid.
      if (
        strategy === this.answeringStrategy &&
        options.reason === PlayerLeaveReason.DISCONNECT &&
        TransitionGuards.isFinalRoundMediaDownloading(game)
      ) {
        continue;
      }

      if (strategy.canHandle(strategyInput)) {
        const strategyResult = await strategy.execute(strategyInput);
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

    // Execute the strategies that depend on the player being gone
    for (const strategy of this.afterRemovalStrategies) {
      if (strategy.canHandle(strategyInput)) {
        const strategyResult = await strategy.execute(strategyInput);
        result.mutations.push(...strategyResult.mutations);
        result.broadcasts.push(...strategyResult.broadcasts);
      }
    }

    // Build broadcasts based on reason
    switch (options.reason) {
      case PlayerLeaveReason.KICK:
        result.broadcasts.push({
          event: SocketIOGameEvents.PLAYER_KICKED,
          data: { playerId: userId } satisfies PlayerKickBroadcastData,
          room: game.id
        });
        result.broadcasts.push({
          event: SocketIOGameEvents.LEAVE,
          data: { user: userId } satisfies GameLeaveEventPayload,
          room: game.id
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
          room: game.id
        });
        break;
    }

    return result;
  }

  public async processGameStateCleanup(
    game: Game,
    userId: number,
    options: PlayerLeaveCleanupOptions = {}
  ): Promise<PlayerLeaveStrategyResult> {
    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: []
    };
    const strategyInput: PlayerLeaveStrategyInput = {
      game,
      userId,
      stakeBidding: options.stakeBidding,
      transitionResources: options.transitionResources
    };

    for (const strategy of this.strategies) {
      if (strategy.canHandle(strategyInput)) {
        const strategyResult = await strategy.execute(strategyInput);
        result.mutations.push(...strategyResult.mutations);
        result.broadcasts.push(...strategyResult.broadcasts);
      }
    }

    return result;
  }
}
