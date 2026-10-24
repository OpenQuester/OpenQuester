import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import {
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";

export interface RegularSkipResult {
  data: QuestionSkipBroadcastData;
  broadcasts: SocketEventBroadcast[];
  game: Game;
  playerId: number;
  gaveUp: false;
}

export interface RegularSkipBuildResultInput {
  game: Game;
  playerId: number;
}

export interface UnskipBuildResultInput {
  game: Game;
  playerId: number;
}

export interface UnskipResult {
  data: QuestionUnskipBroadcastData;
  broadcasts: SocketEventBroadcast[];
  game: Game;
  playerId: number;
}

/** Player pass and unpass operations for regular questions. */
export class PlayerSkipLogic {
  /**
   * Process regular skip: just marks player as skipped.
   */
  public static processRegularSkip(game: Game, player: Player): void {
    game.addSkippedPlayer(player.meta.id);
  }

  /**
   * Process unskip: removes player from skipped list.
   */
  public static processUnskip(game: Game, player: Player): void {
    game.removeSkippedPlayer(player.meta.id);
  }

  /**
   * Build result for regular skip scenario.
   * Includes QUESTION_SKIP broadcast.
   */
  public static buildRegularSkipResult(input: RegularSkipBuildResultInput): RegularSkipResult {
    const { game, playerId } = input;

    const data: QuestionSkipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_SKIP,
        data,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<QuestionSkipBroadcastData>
    ];

    return {
      data,
      broadcasts,
      game,
      playerId,
      gaveUp: false
    };
  }

  /**
   * Build result for unskip scenario.
   * Includes QUESTION_UNSKIP broadcast.
   */
  public static buildUnskipResult(input: UnskipBuildResultInput): UnskipResult {
    const { game, playerId } = input;

    const data: QuestionUnskipBroadcastData = { playerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_UNSKIP,
        data,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<QuestionUnskipBroadcastData>
    ];

    return {
      data,
      broadcasts,
      game,
      playerId
    };
  }
}
