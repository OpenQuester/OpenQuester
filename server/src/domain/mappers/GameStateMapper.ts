import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

export class GameStateMapper {
  public static initGameState(): GameStateDTO {
    return {
      currentRound: null,
      answeredPlayers: null,
      answeringPlayer: null,
      isPaused: false,
      currentQuestion: null,
      questionState: null,
      readyPlayers: null,
      timer: null,
      skippedPlayers: null,
      secretQuestionData: null,
      password: null
    };
  }

  public static getClearGameState(round: GameStateRoundDTO): GameStateDTO {
    return {
      questionState:
        round.type === PackageRoundType.FINAL
          ? QuestionState.THEME_ELIMINATION
          : QuestionState.CHOOSING,
      currentRound: round,
      isPaused: false,
      answeredPlayers: null,
      answeringPlayer: null,
      currentQuestion: null,
      readyPlayers: null,
      timer: null,
      finalRoundData: null,
      skippedPlayers: null,
      secretQuestionData: null,
      password: null
    };
  }
}
