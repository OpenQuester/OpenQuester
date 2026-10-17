import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { ValueUtils } from "domain/utils/ValueUtils";

export interface AnswerUndoResult {
  playerId: number;
  /** The score change that was taken back */
  revertedResult: number;
  newScore: number;
  /** The player may press the buzzer again (the question is still open) */
  canAnswerAgain: boolean;
}

/** Board and ruling corrections the showman can make (SIGame Toggle / Move back) */
export class ShowmanToolsLogic {
  /**
   * Removes an unplayed question from the board, or puts a removed one back.
   * @returns whether the question is now played (removed)
   */
  public static toggleQuestion(game: Game, questionId: number): boolean {
    if (game.gameState.questionState !== QuestionState.CHOOSING) {
      throw new ClientError(ClientResponse.QUESTION_TOGGLE_ONLY_WHILE_CHOOSING);
    }

    for (const theme of game.gameState.currentRound?.themes ?? []) {
      const question = theme.questions.find((q) => q.id === questionId);
      if (question) {
        question.isPlayed = !question.isPlayed;
        return question.isPlayed;
      }
    }

    throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
  }

  /**
   * Takes back the last ruling on the current question: its score change is
   * reverted. After a wrong answer, the player may buzz again.
   */
  public static undoLastRuling(game: Game): AnswerUndoResult {
    const state = game.gameState;
    let last: GameStateAnsweredPlayerData | null = null;
    let canAnswerAgain = false;

    if (state.questionState === QuestionState.SHOWING && state.answeredPlayers?.length) {
      last = state.answeredPlayers[state.answeredPlayers.length - 1];
      state.answeredPlayers = state.answeredPlayers.slice(0, -1);
      if (state.answeredPlayers.length === 0) state.answeredPlayers = null;
      canAnswerAgain = true;
    } else if (state.questionState === QuestionState.SHOWING_ANSWER && state.answerShowData) {
      const data = state.answerShowData as { answerResult?: GameStateAnsweredPlayerData };
      if (data.answerResult) {
        last = data.answerResult;
        delete data.answerResult;
      } else if (state.answeredPlayers?.length) {
        last = state.answeredPlayers[state.answeredPlayers.length - 1];
        state.answeredPlayers = state.answeredPlayers.slice(0, -1);
      }
    }

    if (!last) {
      throw new ClientError(ClientResponse.NOTHING_TO_UNDO);
    }

    const player = game.getPlayer(last.player, { fetchDisconnected: true });
    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }
    player.score = ValueUtils.clampAbs(player.score - last.result, SCORE_ABS_LIMIT);

    return {
      playerId: last.player,
      revertedResult: last.result,
      newScore: player.score,
      canAnswerAgain
    };
  }
}
