import { type Game } from "domain/entities/game/Game";
import { DataMutationType } from "domain/enums/DataMutationType";
import {
  type SocketIOEvents,
  type SocketIOGameEvents,
  type SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  type SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { type BroadcastEvent } from "domain/types/service/ServiceResult";

// ════════════════════════════════════════════════════════════════════════
//  Mutation interfaces — discriminated union on `type`
// ════════════════════════════════════════════════════════════════════════

/**
 * Persist the game entity to Redis via HSET.
 * The executor batches this into the OUT pipeline.
 */
export interface SaveGameMutation {
  readonly type: DataMutationType.SAVE_GAME;
  readonly game: Game;
}

/**
 * SET a timer key with PX (millisecond) expiration.
 * Batched into the OUT pipeline: `SET {key} {value} PX {pxTtl}`
 */
export interface SetTimerMutation {
  readonly type: DataMutationType.TIMER_SET;
  readonly key: string;
  readonly value: string;
  readonly pxTtl: number;
}

/**
 * DEL a timer key.
 * Batched into the OUT pipeline: `DEL {key}`
 */
export interface DeleteTimerMutation {
  readonly type: DataMutationType.TIMER_DELETE;
  readonly key: string;
}

/**
 * Emit a socket broadcast event after the OUT pipeline completes.
 */
export interface BroadcastMutation {
  readonly type: DataMutationType.BROADCAST;
  readonly event: SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;
  readonly data: unknown;
  readonly target: SocketBroadcastTarget;
  readonly gameId?: string;
  readonly socketId?: string;
  readonly useRoleBasedBroadcast?: boolean;
}

/**
 * Trigger game completion lifecycle (statistics persistence, cleanup).
 * Executed after broadcasts are emitted.
 */
export interface GameCompletionMutation {
  readonly type: DataMutationType.GAME_COMPLETION;
  readonly gameId: string;
}

/**
 * Update the Redis socket session to associate the socket with a game.
 *
 * Replaces the hidden `socketUserDataService.update()` call that was scattered
 * inside services. Side effects are now declared, not buried.
 */
export interface UpdateSocketSessionMutation {
  readonly type: DataMutationType.UPDATE_SOCKET_SESSION;
  /** Socket ID to update */
  readonly socketId: string;
  /** Stringified user ID (matches existing Redis schema) */
  readonly userId: string;
  /** Game ID to associate with the socket session */
  readonly gameId: string;
}

/**
 * Discriminated union of all stats side-effects that can be declared
 * as a mutation rather than executed directly in a Use Case.
 */
export type PlayerStatsMutationAction =
  | { readonly action: "INIT_SESSION"; readonly joinedAt: Date }
  | { readonly action: "CLEAR_LEFT_AT" };

/**
 * Apply a player statistics side-effect.
 *
 * Using a mutation instead of a direct call keeps the Use Case pure and
 * all side effects observable in the returned `DataMutation[]`.
 */
export interface UpdatePlayerStatsMutation {
  readonly type: DataMutationType.UPDATE_PLAYER_STATS;
  readonly gameId: string;
  readonly userId: number;
  readonly payload: PlayerStatsMutationAction;
}

/**
 * Discriminated union of all data mutations.
 * Handlers return these as `DataMutation[]` to declare their side effects.
 */
export type DataMutation =
  | SaveGameMutation
  | SetTimerMutation
  | DeleteTimerMutation
  | BroadcastMutation
  | GameCompletionMutation
  | UpdateSocketSessionMutation
  | UpdatePlayerStatsMutation;

/** Create a SAVE_GAME mutation. */
export class DataMutationConverter {
  public static saveGameMutation(game: Game): SaveGameMutation {
    return { type: DataMutationType.SAVE_GAME, game };
  }

  /** Create a TIMER_SET mutation. */
  public static setTimerMutation(
    key: string,
    value: string,
    pxTtl: number
  ): SetTimerMutation {
    return { type: DataMutationType.TIMER_SET, key, value, pxTtl };
  }

  /** Create a TIMER_DELETE mutation. */
  public static deleteTimerMutation(key: string): DeleteTimerMutation {
    return { type: DataMutationType.TIMER_DELETE, key };
  }

  /** Create a BROADCAST mutation targeting the game room. */
  public static gameBroadcastMutation(
    gameId: string,
    event: SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents,
    data: unknown,
    useRoleBasedBroadcast?: boolean
  ): BroadcastMutation {
    return {
      type: DataMutationType.BROADCAST,
      event,
      data,
      target: SocketBroadcastTarget.GAME,
      gameId,
      useRoleBasedBroadcast,
    };
  }

  /** Create a BROADCAST mutation targeting a specific socket. */
  public static socketBroadcastMutation(
    socketId: string,
    event: SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents,
    data: unknown
  ): BroadcastMutation {
    return {
      type: DataMutationType.BROADCAST,
      event,
      data,
      target: SocketBroadcastTarget.SOCKET,
      socketId,
    };
  }

  /** Create a GAME_COMPLETION mutation. */
  public static gameCompletionMutation(gameId: string): GameCompletionMutation {
    return { type: DataMutationType.GAME_COMPLETION, gameId };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Converters — bridge service-layer types to DataMutation
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Convert service-layer {@link TimerMutation} array to DataMutation array.
   * Services (PhaseTransitionRouter, SocketGameTimerService, etc.) still return
   * the old `TimerMutation` type — this bridges them to the new mutation system.
   */
  public static mutationFromTimerMutations(
    mutations: TimerMutation[] | undefined
  ): DataMutation[] {
    if (!mutations || mutations.length === 0) {
      return [];
    }

    return mutations.map((m): DataMutation => {
      if (m.op === "set") {
        return {
          type: DataMutationType.TIMER_SET,
          key: m.key,
          value: m.value,
          pxTtl: m.pxTtl,
        };
      }
      return { type: DataMutationType.TIMER_DELETE, key: m.key };
    });
  }

  /**
   * Convert service-layer {@link BroadcastEvent} array to DataMutation array.
   * Replaces the old `convertBroadcasts` utility from `BroadcastConverter.ts`.
   *
   * @param broadcasts - BroadcastEvent array from service layer
   * @param gameId - Game ID override (defaults to each broadcast's room)
   */
  public static mutationFromServiceBroadcasts(
    broadcasts: BroadcastEvent[] | undefined,
    gameId?: string
  ): DataMutation[] {
    if (!broadcasts || broadcasts.length === 0) {
      return [];
    }

    return broadcasts.map(
      (b): BroadcastMutation => ({
        type: DataMutationType.BROADCAST,
        event: b.event,
        data: b.data,
        target: SocketBroadcastTarget.GAME,
        gameId: gameId ?? b.room,
        useRoleBasedBroadcast: b.roleFilter,
      })
    );
  }

  /**
   * Convert handler-layer {@link SocketEventBroadcast} array to DataMutation array.
   * Bridges logic classes that return `SocketEventBroadcast[]` (which we don't change)
   * to the new `DataMutation[]` system.
   */
  public static mutationFromSocketBroadcasts(
    broadcasts: SocketEventBroadcast[] | undefined
  ): DataMutation[] {
    if (!broadcasts || broadcasts.length === 0) {
      return [];
    }

    return broadcasts.map(
      (b): BroadcastMutation => ({
        type: DataMutationType.BROADCAST,
        event: b.event,
        data: b.data,
        target: b.target ?? SocketBroadcastTarget.GAME,
        gameId: b.gameId,
        socketId: b.socketId,
        useRoleBasedBroadcast: b.useRoleBasedBroadcast,
      })
    );
  }

  /**
   * Declare a socket-session update mutation.
   *
   * Use instead of calling `socketUserDataService.update()` directly inside a
   * Use Case. The {@link DataMutationProcessor} will execute it after the
   * business logic succeeds, keeping all side effects in one auditable list.
   */
  public static updateSocketSession(
    socketId: string,
    userId: number,
    gameId: string
  ): UpdateSocketSessionMutation {
    return {
      type: DataMutationType.UPDATE_SOCKET_SESSION,
      socketId,
      userId: JSON.stringify(userId),
      gameId,
    };
  }

  /**
   * Declare a "initialise player stats session" mutation.
   * Emitted by Join Use Case for brand-new players joining as PLAYER.
   */
  public static initPlayerStatsSession(
    gameId: string,
    userId: number,
    joinedAt: Date
  ): UpdatePlayerStatsMutation {
    return {
      type: DataMutationType.UPDATE_PLAYER_STATS,
      gameId,
      userId,
      payload: { action: "INIT_SESSION", joinedAt },
    };
  }

  /**
   * Declare a "clear leftAt time" mutation.
   * Emitted by Join Use Case for reconnecting players.
   */
  public static clearPlayerLeftAt(
    gameId: string,
    userId: number
  ): UpdatePlayerStatsMutation {
    return {
      type: DataMutationType.UPDATE_PLAYER_STATS,
      gameId,
      userId,
      payload: { action: "CLEAR_LEFT_AT" },
    };
  }
}
