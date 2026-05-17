/**
 * Represents API responses for the server (Responses with 5xx code)
 *
 * These responses should be logged, but not sent to client
 */
export enum ServerResponse {
  // Validation
  NO_SCHEMA = "No validation schema",

  // Session
  UNABLE_TO_DESTROY_SESSION = "Session '%id' of user '%userId' was unable to destroy",

  // S3
  BAD_S3_INIT_WITH_MESSAGE = "Error while initializing S3 context: %message",
  BAD_S3_INIT = "Something went wrong during S3 context initialization",

  // Database
  INVALID_DATA_SOURCE = "Data source is invalid",
  DB_NOT_CONNECTED = "DB is not connected",
  NOT_INITIALIZED = "Data source is not initialized, timeout reached",

  // Redis
  REDIS_CONNECTION_TIMEOUT = "Redis connection timeout",

  // Environment
  FAILED_TO_LOAD_ENV = "Failed to load environment variables, closing...",
  NO_ENV = "Cannot find Node.JS environment",
  INVALID_ENV_TYPE = "Wrong ENV type, only [%types] allowed, but got '%type'",
  ENV_VAR_WRONG_TYPE = "Variable %var is wrong type, %expectedType expected but got variable %value of type %type",

  // Other
  INVALID_ROUND_HANDLER_INPUT = "Invalid round handler input",
  INTERNAL_SERVER_ERROR = "Internal server error"
}
