/**
 * Enum of all possible data mutation types returned by action handlers.
 *
 * Each handler declares its side effects as a `DataMutation[]` array.
 * The {@link DataMutationProcessor} processes them via switch-case,
 * making the post-handler flow explicit and auditable.
 */
export enum DataMutationType {
  /** Persist game entity to Redis (HSET game:{gameId}) */
  SAVE_GAME = "save-game",

  /** Set a timer key with PX expiration (SET key value PX ttl) */
  TIMER_SET = "timer-set",

  /** Delete a timer key (DEL key) */
  TIMER_DELETE = "timer-delete",

  /** Emit a socket broadcast event */
  BROADCAST = "broadcast",

  /** Trigger game completion lifecycle (statistics persistence, cleanup) */
  GAME_COMPLETION = "game-completion",

  /**
   * Update the socket session in Redis to associate the socket with a game.
   * Replaces the hidden `socketUserDataService.update()` call in services.
   */
  UPDATE_SOCKET_SESSION = "update-socket-session",

  /**
   * Apply a player stats side-effect (initialize session or clear leftAt time).
   * Replaces hidden `playerGameStatsService.*` calls scattered across services.
   */
  UPDATE_PLAYER_STATS = "update-player-stats",
}
