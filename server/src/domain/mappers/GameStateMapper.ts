import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateQuestionDTO } from "domain/types/dto/game/state/GameStateQuestionDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageRoundDTO } from "domain/types/dto/package/PackageRoundDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
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
      password: null,
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
      password: null,
    };
  }

  public static getGameRound(
    pack: PackageDTO,
    order: number
  ): GameStateRoundDTO | null {
    const round = pack.rounds.find((round) => round.order === order);

    if (!round) {
      return null;
    }

    return {
      id: round.id!,
      name: round.name,
      type: round.type,
      description: round.description ?? null,
      order: round.order,
      themes: this.getRoundThemes(round),
    };
  }

  public static getRoundThemes(round: PackageRoundDTO): GameStateThemeDTO[] {
    return round.themes.map((theme): GameStateThemeDTO => {
      return {
        id: theme.id!,
        name: theme.name,
        description: theme.description ?? null,
        order: theme.order,
        questions: this.getThemeQuestions(theme),
      };
    });
  }

  public static getThemeQuestions(
    theme: PackageThemeDTO
  ): GameStateQuestionDTO[] {
    return theme.questions.map((question): GameStateQuestionDTO => {
      return {
        id: question.id!,
        order: question.order,
        price: question.isHidden ? null : question.price,
        questionComment: question.questionComment ?? null,
        isPlayed: false,
      };
    });
  }
}
