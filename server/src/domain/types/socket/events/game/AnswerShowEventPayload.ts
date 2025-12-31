import { EmptyOutputData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Payload sent when the answer showing phase starts.
 * This is an empty payload - just signals the transition to SHOWING_ANSWER state.
 * All answer data is already sent via QUESTION_FINISH event.
 */
export type AnswerShowStartEventPayload = EmptyOutputData;

/**
 * Payload sent when the answer showing phase ends.
 * This is an empty payload - just signals transition to CHOOSING state.
 * Round progression events (NEXT_ROUND, GAME_FINISHED) are sent separately if needed.
 */
export type AnswerShowEndEventPayload = EmptyOutputData;
