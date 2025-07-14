import { CHAT_NSP } from "domain/constants/chat";
import { MINUTE_MS, SECOND_MS } from "domain/constants/time";

export const GAME_NAMESPACE = "game";
export const GAME_ID_CHARACTERS_LENGTH = 4;
export const GAME_ID_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const GAME_TITLE_MAX_CHARS = 70;
export const GAME_TITLE_MIN_CHARS = 3;
export const GAME_MAX_PLAYERS = 15;
export const GAME_TTL_IN_SECONDS = 60 * 60 * 2; // 2 hours (updates with every action)
export const GAME_CHAT_NSP = `${CHAT_NSP}:game`;
export const GAME_CHAT_TTL = 60 * 60 * 24 * 21;
export const GAME_CHAT_HISTORY_RETRIEVAL_LIMIT = 100;
export const GAME_QUESTION_ANSWER_TIME = SECOND_MS * 20.5;
export const GAME_QUESTION_ANSWER_SUBMIT_TIME = MINUTE_MS * 1;
export const GAME_FINAL_ANSWER_TIME = SECOND_MS * 75;

// Final Round Constants
export const FINAL_ROUND_BID_TIME = SECOND_MS * 45;
export const FINAL_ROUND_MIN_BID = 1;
