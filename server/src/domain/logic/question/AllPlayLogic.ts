import { ALL_PLAY_MIN_STAKE, SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { AnswerCheckLogic } from "domain/logic/question/AnswerCheckLogic";
import {
  AllPlayDataDTO,
  AllPlayEntryDTO,
  AllPlayMode
} from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ValueUtils } from "domain/utils/ValueUtils";

/**
 * Rules of "everyone answers" questions: stake-for-everyone and
 * no-risk-for-everyone ({@link AllPlayDataDTO}).
 */
export class AllPlayLogic {
  /** The all-play mode of a question, or null for a normal question */
  public static modeOf(question: PackageQuestionDTO | null | undefined): AllPlayMode | null {
    if (question?.subType !== PackageQuestionSubType.FOR_EVERYONE) {
      return null;
    }

    if (question.type === PackageQuestionType.STAKE) {
      return AllPlayMode.STAKE;
    }

    if (question.type === PackageQuestionType.NO_RISK) {
      return AllPlayMode.NO_RISK;
    }

    return null;
  }

  /** Starts the question for every seated, eligible, in-game player */
  public static start(
    game: Game,
    question: PackageQuestionDTO,
    themeId: number,
    mode: AllPlayMode
  ): AllPlayDataDTO {
    const players = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        game.isPlayerEligibleToAnswer(p.meta.id)
    );

    const multiplier = Number(question.priceMultiplier);
    const data: AllPlayDataDTO = {
      mode,
      questionId: question.id!,
      themeId,
      price: question.price ?? 0,
      maxStake: question.maxPrice ?? null,
      priceMultiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : null,
      entries: players.map((p) => ({
        playerId: p.meta.id,
        stake: null,
        answer: null,
        submitted: false,
        isCorrect: null,
        scoreChange: null
      }))
    };

    game.gameState.allPlay = data;

    return data;
  }

  /** Highest stake a player may make: their score, at least the price, capped by the package */
  public static maxStakeFor(game: Game, data: AllPlayDataDTO, playerId: number): number {
    const score = game.getPlayer(playerId, { fetchDisconnected: true })?.score ?? 0;
    const affordable = Math.max(score, data.price, ALL_PLAY_MIN_STAKE);

    return data.maxStake !== null
      ? Math.max(ALL_PLAY_MIN_STAKE, Math.min(affordable, data.maxStake))
      : affordable;
  }

  public static submitStake(game: Game, playerId: number, amount: number): AllPlayEntryDTO {
    const data = this._require(game, QuestionState.BIDDING);
    const entry = this._entry(data, playerId);

    if (entry.stake !== null) {
      throw new ClientError(ClientResponse.ALL_PLAY_ALREADY_SUBMITTED);
    }

    const max = this.maxStakeFor(game, data, playerId);
    if (!Number.isInteger(amount) || amount < ALL_PLAY_MIN_STAKE || amount > max) {
      throw new ClientError(ClientResponse.ALL_PLAY_INVALID_STAKE, 400, {
        min: ALL_PLAY_MIN_STAKE,
        max
      });
    }

    entry.stake = amount;

    return entry;
  }

  /** Players who haven't staked get the lower of the price and what they may stake */
  public static fillMissingStakes(game: Game): void {
    const data = game.gameState.allPlay;
    if (!data) {
      return;
    }

    for (const entry of data.entries) {
      if (entry.stake === null) {
        entry.stake = Math.min(
          Math.max(data.price, ALL_PLAY_MIN_STAKE),
          this.maxStakeFor(game, data, entry.playerId)
        );
      }
    }
  }

  public static submitAnswer(game: Game, playerId: number, answer: string): AllPlayEntryDTO {
    const data = this._require(game, QuestionState.SHOWING);
    const entry = this._entry(data, playerId);

    if (entry.submitted) {
      throw new ClientError(ClientResponse.ALL_PLAY_ALREADY_SUBMITTED);
    }

    entry.answer = answer.trim();
    entry.submitted = true;

    return entry;
  }

  /** Everyone still in the game has staked */
  public static allStaked(game: Game): boolean {
    return this._activeEntries(game).every((e) => e.stake !== null);
  }

  /** Everyone still in the game has answered */
  public static allAnswered(game: Game): boolean {
    return this._activeEntries(game).every((e) => e.submitted);
  }

  /**
   * Starts the review: a missing or empty answer is wrong without the
   * showman's ruling, and answers the server can check (choice, number,
   * point) are ruled right away. Returns the entries ruled automatically.
   */
  public static startReview(game: Game, question?: PackageQuestionDTO | null): AllPlayEntryDTO[] {
    const data = game.gameState.allPlay;
    if (!data) {
      return [];
    }

    const auto: AllPlayEntryDTO[] = [];

    for (const entry of data.entries) {
      const verdict = entry.answer ? AnswerCheckLogic.check(question, entry.answer) : false;
      if (verdict !== null) {
        this._rule(game, data, entry, verdict);
        auto.push(entry);
      }
    }

    return auto;
  }

  /** Applies the showman's ruling on one answer and the player's score change */
  public static review(game: Game, playerId: number, isCorrect: boolean): AllPlayEntryDTO {
    const data = this._require(game, QuestionState.REVIEWING);
    const entry = this._entry(data, playerId);

    if (entry.isCorrect !== null) {
      throw new ClientError(ClientResponse.ALL_PLAY_ALREADY_REVIEWED);
    }

    this._rule(game, data, entry, isCorrect);

    return entry;
  }

  public static allReviewed(game: Game): boolean {
    return (game.gameState.allPlay?.entries ?? []).every((e) => e.isCorrect !== null);
  }

  public static scoreChange(
    data: AllPlayDataDTO,
    entry: AllPlayEntryDTO,
    isCorrect: boolean
  ): number {
    if (data.mode === AllPlayMode.STAKE) {
      const stake = entry.stake ?? data.price;

      return isCorrect ? stake : -stake;
    }

    return isCorrect ? Math.round(data.price * (data.priceMultiplier ?? 1)) : 0;
  }

  /** Copy for players who must not see the others' answers or stakes yet */
  public static hideFromPlayers(
    data: AllPlayDataDTO,
    questionState: QuestionState | null
  ): AllPlayDataDTO {
    const revealed =
      questionState === QuestionState.REVIEWING || questionState === QuestionState.SHOWING_ANSWER;
    if (revealed) {
      return data;
    }

    return {
      ...data,
      entries: data.entries.map((e) => ({
        ...e,
        stake: e.stake === null ? null : 0,
        answer: e.answer === null ? null : ""
      }))
    };
  }

  private static _rule(
    game: Game,
    data: AllPlayDataDTO,
    entry: AllPlayEntryDTO,
    isCorrect: boolean
  ): void {
    const change = this.scoreChange(data, entry, isCorrect);
    entry.isCorrect = isCorrect;
    entry.scoreChange = change;
    const player = game.getPlayer(entry.playerId, { fetchDisconnected: true });
    if (player) {
      player.score = ValueUtils.clampAbs(player.score + change, SCORE_ABS_LIMIT);
    }
  }

  private static _activeEntries(game: Game): AllPlayEntryDTO[] {
    const data = game.gameState.allPlay;
    if (!data) {
      return [];
    }

    return data.entries.filter((e) => {
      const player = game.getPlayer(e.playerId, { fetchDisconnected: false });

      return !!player && player.role === PlayerRole.PLAYER;
    });
  }

  private static _require(game: Game, state: QuestionState): AllPlayDataDTO {
    const data = game.gameState.allPlay;
    if (!data || game.gameState.questionState !== state) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    return data;
  }

  private static _entry(data: AllPlayDataDTO, playerId: number): AllPlayEntryDTO {
    const entry = data.entries.find((e) => e.playerId === playerId);
    if (!entry) {
      throw new ClientError(ClientResponse.ALL_PLAY_NOT_PARTICIPANT);
    }

    return entry;
  }
}
