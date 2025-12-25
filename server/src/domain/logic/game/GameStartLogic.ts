import { Game } from "domain/entities/game/Game";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

export class GameStartLogic {
  public static buildInitialGameState(game: Game): GameStateDTO {
    const currentTurnPlayerId = game.getRandomTurnPlayer();

    return {
      currentRound: GameStateMapper.getGameRound(game.package, 0),
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
}
