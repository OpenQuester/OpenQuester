/**
 * Centralized log prefixes for consistent log categorization.
 *
 * Prefixes help identify the subsystem that generated the log.
 * Use these constants instead of hardcoded strings to:
 * - Ensure consistency across the codebase
 * - Enable easy refactoring
 * - Facilitate log searching/filtering
 */
export enum LogPrefix {
  // === Core Infrastructure ===
  /** Server startup, shutdown, configuration */
  SERVER = "[SERVER]: ",
  /** Database operations (TypeORM, queries) */
  DB = "[DB]: ",
  /** Redis operations (cache, pub/sub, locks) */
  REDIS = "[REDIS]: ",
  /** S3/MinIO file storage operations */
  S3 = "[S3]: ",
  /** Environment loading and configuration */
  ENV = "[ENV]: ",
  /** Test bootstrap and harness */
  TEST = "[TEST]: ",

  // === HTTP/Socket Layer ===
  /** HTTP request handling, middleware */
  HTTP = "[HTTP]: ",
  /** Socket.IO connection, events */
  SOCKET = "[SOCKET]: ",
  /** CORS configuration */
  CORS = "[CORS]: ",

  // === Game Engine ===
  /** Game action execution, queue processing */
  ACTION = "[ACTION]: ",
  /** Game state machine transitions */
  STATE_MACHINE = "[STATE_MACHINE]: ",
  /** Timer expiration handling */
  TIMER = "[TIMER]: ",
  /** Game broadcasts to players */
  BROADCAST = "[BROADCAST]: ",

  // === Authentication & Admin ===
  /** Authentication, authorization */
  AUTH = "[AUTH]: ",
  /** Admin panel operations */
  ADMIN = "[ADMIN]: ",
  /** User management */
  USER = "[USER]: ",

  // === Background Jobs ===
  /** Cron job scheduling and job execution */
  CRON = "[CRON]: ",
  /** Cron scheduler lifecycle (init, stop) */
  CRON_SCHEDULER = "[CRON_SCHEDULER]: ",
  /** S3 cleanup job */
  S3_CLEANUP = "[S3_CLEANUP]: ",
  /** Statistics persistence and collection */
  STATS = "[STATS]: ",
  /** Game statistics worker */
  STATS_WORKER = "[STATS_WORKER]: ",
  /** Player game stats service */
  PLAYER_STATS = "[PLAYER_STATS]: ",

  // === Services ===
  /** Translation service */
  TRANSLATE = "[TRANSLATE]: ",
  /** User notifications */
  NOTIFICATION = "[NOTIFICATION]: ",
  /** Game repository operations */
  GAME = "[GAME]: ",
  /** Game index manager */
  GAME_INDEX = "[GAME_INDEX]: ",
  /** Action broadcast service */
  ACTION_BROADCAST = "[ACTION_BROADCAST]: ",
  /** Action handler registry */
  ACTION_REGISTRY = "[ACTION_REGISTRY]: ",
  /** Action config */
  ACTION_CONFIG = "[ACTION_CONFIG]: ",
  /** Timer expiration service */
  TIMER_EXPIRATION = "[TIMER_EXPIRATION]: ",

  // === Error Handling ===
  /** Error controller, error middleware */
  ERROR = "[ERROR]: ",

  // === Migrations ===
  /** Database migrations */
  MIGRATION = "[MIGRATION]: ",

  // === Presentation Layer ===
  /** Socket event emitter */
  IO_EMITTER = "[IO_EMITTER]: ",
  /** Socket event handler registry */
  SOCKET_REGISTRY = "[SOCKET_REGISTRY]: ",
  /** Socket question service */
  SOCKET_QUESTION = "[SOCKET_QUESTION]: ",
  /** Socket initializer */
  SOCKET_INIT = "[SOCKET_INIT]: ",
  /** Serve API initialization */
  SERVE_API = "[SERVE_API]: ",
  /** Swagger/OpenAPI docs */
  SWAGGER = "[SWAGGER]: ",
  /** Development endpoints */
  DEV = "[DEV]: ",
  /** Socket.IO CORS configuration */
  IO_CORS = "[IO CORS]: ",
  /** Error middleware */
  ERROR_MIDDLEWARE = "[ERROR_MIDDLEWARE]: ",
  /** Metrics collection and server */
  METRICS = "[METRICS]: ",
}

/** Type for log prefix values */
