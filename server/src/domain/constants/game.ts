import { CHAT_NSP } from "domain/constants/chat";
import { MINUTE_MS, SECOND_MS } from "domain/constants/time";

// TODO: Avoid math operations in constants since they executed every time the constant accessed (investigate if true)

export const GAME_NAMESPACE = "game";
export const GAME_INDEX_PREFIX = `${GAME_NAMESPACE}:index`;
export const GAME_INDEX_CREATED_AT_KEY = `${GAME_INDEX_PREFIX}:createdAt`;
export const GAME_ID_CHARACTERS_LENGTH = 4;
export const GAME_ID_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const GAME_PASSWORD_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const GAME_PASSWORD_LENGTH = 4;
export const GAME_TITLE_MAX_CHARS = 70;
export const GAME_TITLE_MIN_CHARS = 3;
export const GAME_MAX_PLAYERS = 15;
export const SYSTEM_PLAYER_ID = -1;
export const SYSTEM_SOCKET_ID = "SYSTEM";
/** 2 hours (updates with almost every action) */
export const GAME_TTL_IN_SECONDS = 60 * 60 * 2;
/** 15 minutes */
export const GAME_EXPIRATION_WARNING_SECONDS = 60 * 15;
export const GAME_EXPIRATION_WARNING_NAMESPACE = "game-expiration-warning";
export const GAME_CHAT_NSP = `${CHAT_NSP}:game`;
/** 3 weeks */
export const GAME_CHAT_TTL = 60 * 60 * 24 * 21;
export const GAME_CHAT_HISTORY_RETRIEVAL_LIMIT = 100;
/** 20.5 seconds */
export const GAME_QUESTION_ANSWER_TIME = SECOND_MS * 20.5;
/** 1 minute */
export const GAME_QUESTION_ANSWER_SUBMIT_TIME = MINUTE_MS;
/** 30 seconds - how long the question waits for every player to load its media */
export const MEDIA_DOWNLOAD_TIMEOUT = SECOND_MS * 30;
/** 75 seconds */
export const GAME_FINAL_ANSWER_TIME = SECOND_MS * 75;
/** 30 seconds - timeout for deciding secret question transfer target */
export const SECRET_QUESTION_TRANSFER_TIME = SECOND_MS * 30;

// Question content sequencing (see domain/logic/question/QuestionContentPlanLogic.ts)
/** Reading speed for a sequenced text step: 50 ms per character (20 chars/s) */
export const CONTENT_TEXT_MS_PER_CHAR = 50;
/** 2 seconds - shortest time a sequenced text stays on screen */
export const CONTENT_TEXT_MIN_TIME = SECOND_MS * 2;
/** 15 seconds - longest default time for a sequenced text */
export const CONTENT_TEXT_MAX_TIME = SECOND_MS * 15;
/** 5 seconds - default time an image stays on screen */
export const CONTENT_IMAGE_TIME = SECOND_MS * 5;
/** 20 seconds - audio/video play time when nobody reported its real length */
export const CONTENT_MEDIA_UNKNOWN_TIME = SECOND_MS * 20;
/** 2 minutes - upper bound for one content item (SIGame uses the same cap) */
export const CONTENT_ITEM_MAX_TIME = SECOND_MS * 120;

// Show Answer Duration Constants
/** 5 seconds - default duration for showing answer (text-only or image) */
export const SHOW_ANSWER_DURATION_TEXT = SECOND_MS * 5;
/** 10 seconds - default duration for showing answer with audio */
export const SHOW_ANSWER_DURATION_AUDIO = SECOND_MS * 10;
/** 15 seconds - default duration for showing answer with video */
export const SHOW_ANSWER_DURATION_VIDEO = SECOND_MS * 15;

// Final Round Constants
/** 45 seconds */
export const FINAL_ROUND_BID_TIME = SECOND_MS * 45;
export const FINAL_ROUND_MIN_BID = 1;
export const FINAL_ROUND_ANSWER_MAX_LENGTH = 500;
/** 30 seconds per turn for theme elimination */
export const FINAL_ROUND_THEME_ELIMINATION_TIME = SECOND_MS * 30;

// Stake Question Constants
/** 30 seconds per bid for stake questions */
export const STAKE_QUESTION_BID_TIME = SECOND_MS * 30;
export const STAKE_QUESTION_MIN_BID = 1;

/** Absolute cap for player score magnitude (soft cap below exact int32 bounds) */
export const SCORE_ABS_LIMIT = 2_100_000_000;
/** Max price allowed for a question on package upload */
export const MAX_QUESTION_PRICE_UPLOAD = 1_000_000;
/** Max absolute score delta that can be applied per answer (+/-) */
export const MAX_SCORE_DELTA = 2_000_000;
