export const SOCKET_REDIS_NSP = "socket";
export const SOCKET_ROOT_NAMESPACE = "/";
export const SOCKET_SESSION_PREFIX = `${SOCKET_REDIS_NSP}:session`;
export const SOCKET_USER_PREFIX = `${SOCKET_REDIS_NSP}:user`;
export const SOCKET_USER_MUTE_PREFIX = `${SOCKET_USER_PREFIX}:mute`;
export const SOCKET_RUNTIME_CONTEXT_UPDATE_EVENT = "socket:runtime-context-update";
/** 1 week */
export const SOCKET_GAME_AUTH_TTL = 60 * 60 * 24 * 7;
export const SOCKET_GAME_NAMESPACE = "/games";
