export const TEST_TIMEOUTS = {
  // Connection and handshake timeouts
  SOCKET_CONNECT_MS: 250,
  SOCKET_CONNECT_TIMEOUT_MS: 5000,

  // Event waiting defaults
  SOCKET_EVENT_WAIT_MS: 1500,
  SOCKET_TIMER_EVENT_WAIT_MS: 2500,
  SOCKET_NO_EVENT_WAIT_MS: 100,
  SOCKET_ACTION_TIMEOUT_MS: 500,
  SOCKET_TEST_MANUAL_TIMEOUT_MS: 500,

  // Action queue drain timeout and polling
  ACTION_QUEUE_WAIT_MS: 500,
  ACTION_QUEUE_POLL_INTERVAL_MS: 25,

  // Redis/keyspace wait helper
  REDIS_EXPIRY_WAIT_MS: 100,

  // Cleanup delays
  TEST_CLEANUP_DRAIN_MS: 25,

  // Package / game-flow delays used in tests
  PACKAGE_QUESTION_ANSWER_DELAY_MS: 200,
  PACKAGE_QUESTION_SHOW_ANSWER_DURATION_MS: 200,

  // Test infra defaults for workers/db/redis
  TEST_DB_NAME_PREFIX: "test_db",
  TEST_REDIS_DB_BASE: 1,
  TEST_REDIS_DB_FALLBACK: 0,
  TEST_API_PORT_START: 3030
} as const;

export const TEST_WORKER_ID = process.env.JEST_WORKER_ID || "1";

export const getTestDbName = (): string => {
  const baseName = process.env.TEST_DB_NAME_PREFIX ?? TEST_TIMEOUTS.TEST_DB_NAME_PREFIX;
  return `${baseName}_${TEST_WORKER_ID}`;
};

export const getTestApiPort = (): number => {
  const basePort = TEST_TIMEOUTS.TEST_API_PORT_START;
  const workerOffset = Number.parseInt(TEST_WORKER_ID, 10);
  return basePort + (Number.isNaN(workerOffset) ? 0 : workerOffset - 1);
};

export const getTestRedisDb = (): number => {
  const configured = process.env.TEST_REDIS_DB_NUMBER;
  if (configured !== undefined) {
    const explicit = Number.parseInt(configured, 10);
    if (!Number.isNaN(explicit)) {
      return explicit;
    }
  }

  const workerOffset = Number.parseInt(TEST_WORKER_ID, 10);
  if (Number.isNaN(workerOffset)) {
    return TEST_TIMEOUTS.TEST_REDIS_DB_FALLBACK;
  }

  const redisDbRange = 14;
  return (Math.abs(workerOffset - 1) % redisDbRange) + TEST_TIMEOUTS.TEST_REDIS_DB_BASE;
};
