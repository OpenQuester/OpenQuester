/**
 * Compare-and-delete Lua script for safe lock release.
 * Only deletes the lock if the stored value matches the provided token,
 * preventing a caller from releasing a lock it no longer owns.
 */
export const COMPARE_AND_DELETE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

/**
 * Atomic drain-and-reacquire Lua script for queue processing.
 *
 * Ensures no external request can acquire the lock between queue drain
 * iterations. The lock is either released (queue empty) or atomically
 * swapped (queue has items) — it is never "free" in between.
 *
 * When queue has items, also prefetches game state and timer in the same
 * atomic operation. Socket/user context is embedded in the queued action
 * snapshot by the dispatcher, so the drain script does not parse action JSON
 * or read socket sessions.
 *
 * KEYS[1] = lock key
 * KEYS[2] = queue key
 * KEYS[3] = game hash key
 * KEYS[4] = timer key
 * ARGV[1] = current lock token (ownership proof)
 * ARGV[2] = new lock token (replacement)
 * ARGV[3] = lock TTL in seconds
 * ARGV[4] = game TTL in seconds
 */
export const DRAIN_AND_REACQUIRE_SCRIPT = `
  -- Verify lock ownership
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then
    return {0}
  end

  -- Pop next action from queue
  local action = redis.call('LPOP', KEYS[2])
  if not action then
    -- Queue empty — release lock
    redis.call('DEL', KEYS[1])
    return {1}
  end

  -- Reacquire lock with new token
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])

  -- Prefetch game state
  local gameData = redis.call('HGETALL', KEYS[3])
  redis.call('EXPIRE', KEYS[3], ARGV[4])

  -- Prefetch timer
  local timer = redis.call('GET', KEYS[4]) or ''

  -- Pack result: [status, newToken, action, timer, ...gameHashFields]
  local result = {2, ARGV[2], action, timer}
  for i = 1, #gameData do
    result[#result + 1] = gameData[i]
  end
  return result
`;

/**
 * Atomically enqueue an action and try to become the queue processor.
 *
 * KEYS[1] = queue key
 * KEYS[2] = lock key
 * ARGV[1] = serialized action
 * ARGV[2] = lock token
 * ARGV[3] = lock TTL seconds
 *
 * Returns {1, token} if this caller should drain the queue, otherwise {0, ""}.
 */
export const QUEUE_ACTION_AND_TRY_LOCK_SCRIPT = `
  redis.call('RPUSH', KEYS[1], ARGV[1])
  local locked = redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3], 'NX')
  if locked then
    return {1, ARGV[2]}
  end
  return {0, ''}
`;
