import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  AnswerShowEndEventPayload,
  AnswerShowStartEventPayload,
} from "domain/types/socket/events/game/AnswerShowEventPayload";

type BroadcastEvent<T> = {
  event: SocketIOGameEvents;
  data: T;
  room: string;
};

/**
 * Logic class for handling show answer phase.
 * Extracts business logic for answer showing timer and broadcasts.
 */
export class ShowAnswerLogic {
  /**
   * Build the ANSWER_SHOW_START broadcast event.
   * This is an empty payload - just signals the transition.
   */
  public static buildAnswerShowStartBroadcast(
    gameId: string
  ): BroadcastEvent<AnswerShowStartEventPayload> {
    return {
      event: SocketIOGameEvents.ANSWER_SHOW_START,
      data: {} satisfies AnswerShowStartEventPayload,
      room: gameId,
    };
  }

  /**
   * Build the ANSWER_SHOW_END broadcast event.
   * This is an empty payload - just signals the end of show answer phase.
   */
  public static buildAnswerShowEndBroadcast(
    gameId: string
  ): BroadcastEvent<AnswerShowEndEventPayload> {
    return {
      event: SocketIOGameEvents.ANSWER_SHOW_END,
      data: {} satisfies AnswerShowEndEventPayload,
      room: gameId,
    };
  }

  /**
   * Determine if round progression is needed after answer showing.
   */
  public static shouldProgressRound(game: Game): boolean {
    return game.isAllQuestionsPlayed() ?? false;
  }
}
