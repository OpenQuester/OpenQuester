import { MINUTE_MS } from "domain/constants/time";

export const CACHE_KEY = "cache";
/** 2 minutes */
export const REDIS_CACHE_DEFAULT_KEY_EXPIRE = MINUTE_MS * 2;

// User
export const USER_CACHE_KEY = `${CACHE_KEY}:user`;
/** 5 minutes */
export const USER_CACHE_KEY_TTL = MINUTE_MS * 5;
