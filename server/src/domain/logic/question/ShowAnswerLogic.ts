import {
  SHOW_ANSWER_DURATION_AUDIO,
  SHOW_ANSWER_DURATION_TEXT,
  SHOW_ANSWER_DURATION_VIDEO,
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import {
  AnswerShowEndEventPayload,
  AnswerShowStartEventPayload,
} from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { EmptyOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { PackageFileType } from "domain/enums/package/PackageFileType";

export interface SkipShowAnswerResult {
  data: EmptyOutputData;
  broadcasts: SocketEventBroadcast[];
}

export interface SkipShowAnswerBuildResultInput {
  gameId: string;
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
}

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
   * Calculate the duration for showing the answer.
   * Based on answer files (media stacking) or fallback default.
   */
  public static calculateShowAnswerDuration(
    question: PackageQuestionDTO | null
  ): number {
    if (!question) {
      return SHOW_ANSWER_DURATION_TEXT;
    }

    const { answerFiles } = question;

    if (answerFiles && answerFiles.length > 0) {
      let duration = 0;
      for (const file of answerFiles) {
        if (file.displayTime && file.displayTime > 0) {
          duration += file.displayTime;
        } else {
          switch (file.file.type) {
            case PackageFileType.VIDEO:
              duration += SHOW_ANSWER_DURATION_VIDEO;
              break;
            case PackageFileType.AUDIO:
              duration += SHOW_ANSWER_DURATION_AUDIO;
              break;
            // Images and text use the text duration
            case PackageFileType.IMAGE:
            default:
              duration += SHOW_ANSWER_DURATION_TEXT;
              break;
          }
        }
      }
      return duration > 0 ? duration : SHOW_ANSWER_DURATION_TEXT;
    }

    return question.showAnswerDuration > 0
      ? question.showAnswerDuration
      : SHOW_ANSWER_DURATION_TEXT;
  }

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

  /**
   * Build result for skip show answer action with broadcasts.
   * Includes ANSWER_SHOW_END and conditional NEXT_ROUND/GAME_FINISHED broadcasts.
   */
  public static buildSkipShowAnswerResult(
    input: SkipShowAnswerBuildResultInput
  ): SkipShowAnswerResult {
    const { gameId, isGameFinished, nextGameState } = input;

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.ANSWER_SHOW_END,
        data: {} satisfies AnswerShowEndEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<AnswerShowEndEventPayload>,
    ];

    if (nextGameState) {
      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: {
          gameState: nextGameState,
        } satisfies GameNextRoundEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<GameNextRoundEventPayload>);
    }

    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId,
      } satisfies SocketEventBroadcast<boolean>);
    }

    return {
      data: {},
      broadcasts,
    };
  }
}
