import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameStartBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Result from game start operation
 */
export interface GameStartResult {
  data: {
    game: Game;
    currentRound: GameStateDTO["currentRound"];
  };
  broadcasts: SocketEventBroadcast[];
}

export class GameStartLogic {
  /**
   * Build initial game state with the first round data.
   * @param game Game entity
   * @param firstRound The first round fetched from PackageStore
   */
  public static buildInitialGameState(
    game: Game,
    firstRound: GameStateRoundDTO | null
  ): GameStateDTO {
    const currentTurnPlayerId = game.getRandomTurnPlayer();

    return {
      currentRound: firstRound,
      isPaused: false,
      questionState: QuestionState.CHOOSING,
      answeredPlayers: null,
      answeringPlayer: null,
      currentQuestion: null,
      readyPlayers: null,
      timer: null,
      currentTurnPlayerId,
      skippedPlayers: null,
    };
  }

  /**
   * Build result with broadcasts for game start
   */
  public static buildResult(game: Game): GameStartResult {
    const currentRound = game.gameState.currentRound!;

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.START,
        data: { currentRound } satisfies GameStartBroadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<GameStartBroadcastData>,
    ];

    return {
      data: { game, currentRound },
      broadcasts,
    };
  }
}
