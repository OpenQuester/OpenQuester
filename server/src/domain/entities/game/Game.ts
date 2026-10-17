import { MAX_SCORE_DELTA, SCORE_ABS_LIMIT } from "domain/constants/game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameImportDTO } from "domain/types/dto/game/GameImportDTO";
import { GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import { RoundIndexEntry } from "domain/types/dto/game/RoundIndexEntry";
import {
  GameStateAnsweredPlayerData,
  GameStateDTO
} from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import type { GameSettingsDTO } from "domain/types/dto/game/settings/GameSettingsDTO";
import { GameSettingsLogic } from "domain/logic/game/GameSettingsLogic";
import { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GetPlayerOptions } from "domain/types/game/GetPlayerOptions";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { userId } from "domain/types/ids";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerMeta } from "domain/types/socket/game/PlayerMeta";
import { ValueUtils } from "domain/utils/ValueUtils";

type PlayerAndIndex = {
  player: Player | null;
  index: number;
};

export class Game {
  /** Questions answered by whoever buzzes first; the wrong-answer penalty applies to these */
  private static readonly BUZZER_QUESTION_TYPES: ReadonlySet<PackageQuestionType> = new Set([
    PackageQuestionType.SIMPLE,
    PackageQuestionType.CHOICE,
    PackageQuestionType.HIDDEN
  ]);

  private readonly _id: string;
  private _title: string;
  private readonly _createdBy: userId;
  private readonly _createdAt: Date;
  private _isPrivate: boolean;
  private _ageRestriction: AgeRestriction;
  private _maxPlayers: number;
  private _startedAt: Date | null;
  private _finishedAt: Date | null;
  private _roundIndex: RoundIndexEntry[];
  private _roundsCount: number;
  private _questionsCount: number;
  private readonly _players: Player[];
  private _gameState: GameStateDTO;
  private _settings: GameSettingsDTO;

  constructor(data: GameImportDTO) {
    this._id = data.id;
    this._title = data.title;
    this._createdBy = data.createdBy;
    this._createdAt = data.createdAt;
    this._isPrivate = data.isPrivate;
    this._ageRestriction = data.ageRestriction;
    this._maxPlayers = data.maxPlayers;
    this._startedAt = data.startedAt;
    this._finishedAt = data.finishedAt;
    this._roundIndex = data.roundIndex;
    this._roundsCount = data.roundsCount;
    this._questionsCount = data.questionsCount;
    this._players = data.players;
    this._gameState = data.gameState;
    this._settings = GameSettingsLogic.normalize(data.settings);
  }

  // Getters
  public get id() {
    return this._id;
  }

  public get title() {
    return this._title;
  }

  public set title(title: string) {
    this._title = title;
  }

  public get createdBy() {
    return this._createdBy;
  }

  public get createdAt() {
    return this._createdAt;
  }

  public get isPrivate() {
    return this._isPrivate;
  }

  public set isPrivate(isPrivate: boolean) {
    this._isPrivate = isPrivate;
  }

  public get ageRestriction() {
    return this._ageRestriction;
  }

  public set ageRestriction(ageRestriction: AgeRestriction) {
    this._ageRestriction = ageRestriction;
  }

  public get settings(): GameSettingsDTO {
    return this._settings;
  }

  public set settings(settings: GameSettingsDTO) {
    this._settings = GameSettingsLogic.normalize(settings);
  }

  public get maxPlayers() {
    return this._maxPlayers;
  }

  public set maxPlayers(maxPlayers: number) {
    this._maxPlayers = maxPlayers;
  }

  public get startedAt() {
    return this._startedAt;
  }

  public set startedAt(startedAt: Date | null) {
    this._startedAt = startedAt;
  }

  public get roundIndex(): RoundIndexEntry[] {
    return this._roundIndex;
  }

  public set roundIndex(roundIndex: RoundIndexEntry[]) {
    this._roundIndex = roundIndex;
  }

  public set roundsCount(roundsCount: number) {
    this._roundsCount = roundsCount;
  }

  public set questionsCount(questionsCount: number) {
    this._questionsCount = questionsCount;
  }

  public set password(password: string | null) {
    this._gameState.password = password;
  }

  public get roundsCount() {
    return this._roundsCount;
  }

  public get questionsCount() {
    return this._questionsCount;
  }

  public get players() {
    return this._players;
  }

  public get playersCount() {
    return this._players.length;
  }

  public get gameState() {
    return this._gameState;
  }

  public set gameState(gameState: GameStateDTO) {
    this._gameState = gameState;
  }

  public get finishedAt() {
    return this._finishedAt;
  }

  public hasPlayer(userId: number): boolean {
    return this._players.some(
      (p) => p.meta.id === userId && p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  public async addPlayer(
    meta: PlayerMeta,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<Player> {
    const playerData = this._players.find((p) => p.meta.id === meta.id);

    const slotIdx = this._resolveJoinSlot(role, targetSlot, playerData?.gameSlot);

    if (playerData) {
      playerData.gameStatus = PlayerGameStatus.IN_GAME;
      playerData.role = role;
      playerData.gameSlot = slotIdx;
      // Always update meta with current user data
      playerData.updateMeta(meta);

      return playerData;
    }

    const player = new Player({
      meta: meta,
      role,
      restrictionData: {
        banned: false,
        muted: false,
        restricted: false
      },
      score: 0,
      status: PlayerGameStatus.IN_GAME,
      slot: slotIdx
    });

    this._players.push(player);

    return player;
  }

  public getPlayer(userId: number, opts: GetPlayerOptions): Player | null {
    const player = this._players.find((p) => {
      if (p.meta.id !== userId) {
        return false;
      }

      if (opts.fetchDisconnected) {
        return true;
      }

      return p.gameStatus === PlayerGameStatus.IN_GAME;
    });

    return player ?? null;
  }

  public getPlayerAndIndex(userId: number, opts: GetPlayerOptions): PlayerAndIndex {
    const playerIndex = this._players.findIndex((p) => {
      if (p.meta.id !== userId) {
        return false;
      }

      if (opts.fetchDisconnected) {
        return true;
      }

      return p.gameStatus === PlayerGameStatus.IN_GAME;
    });

    return {
      player: playerIndex !== -1 ? this._players[playerIndex] : null,
      index: playerIndex
    };
  }

  /** Get all players in game excluding showman */
  public getInGamePlayers(): Player[] {
    return this.players.filter(
      (p) => p.role === PlayerRole.PLAYER && p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  /** Includes showman */
  public getActivePlayers(): Player[] {
    return this.players.filter((p) => p.gameStatus === PlayerGameStatus.IN_GAME);
  }

  public getRandomTurnPlayer() {
    const inGamePlayers = this.getInGamePlayers();
    if (inGamePlayers.length > 0) {
      // Select a random player using Math.random for index
      const randomIndex = Math.floor(Math.random() * inGamePlayers.length);

      return inGamePlayers[randomIndex].meta.id;
    }

    return null;
  }

  public removePlayer(userId: number): void {
    const player = this.getPlayer(userId, { fetchDisconnected: false });
    if (player) {
      player.gameStatus = PlayerGameStatus.DISCONNECTED;
    }
  }

  /**
   * @returns Whether showman slot is taken
   */
  public checkShowmanSlotIsTaken(): boolean {
    return this._players.some(
      (p) => p.role === PlayerRole.SHOWMAN && p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  /**
   * The round's time limit (settings.timers.roundMs) has passed, not counting
   * paused time. Regular rounds only; 0 means no limit.
   */
  public isRoundTimeUp(now: number = Date.now()): boolean {
    const limit = this._settings.timers.roundMs;
    const startedAt = this._gameState.roundStartedAt;
    if (!limit || !startedAt || this._gameState.currentRound?.type === PackageRoundType.FINAL) {
      return false;
    }

    const pausedNow = this._gameState.pausedAt ? now - this._gameState.pausedAt : 0;

    return now - startedAt - (this._gameState.roundPausedMs ?? 0) - pausedNow >= limit;
  }

  /** Every question is played, or the round's time is up */
  public isRoundOver(): boolean {
    return (this.isAllQuestionsPlayed() ?? false) || this.isRoundTimeUp();
  }

  public isAllQuestionsPlayed() {
    if (!this.gameState || !this.gameState.currentRound) {
      return;
    }

    const { played, all } = GameQuestionMapper.getPlayedAndAllQuestions(this.gameState);

    return all.length > 0 && played.length === all.length;
  }

  /**
   * Check if a next round exists using the lightweight round index.
   * Returns the matching entry (order + type) or null if no next round.
   */
  public getNextRound(): RoundIndexEntry | null {
    if (!ValueUtils.isNumber(this.gameState.currentRound?.order)) {
      return null;
    }

    const nextOrder = this.gameState.currentRound!.order + 1;

    return this._roundIndex.find((r) => r.order === nextOrder) ?? null;
  }

  public finish() {
    this._finishedAt = new Date();
  }

  public pause() {
    this._gameState.isPaused = true;
    this._gameState.pausedAt = Date.now();
    // Presses waiting for the draw are dropped; players press again after the pause
    this._gameState.buzzerWindow = null;
  }

  public unpause() {
    this._gameState.isPaused = false;
    if (this._gameState.pausedAt) {
      this._gameState.roundPausedMs =
        (this._gameState.roundPausedMs ?? 0) + Math.max(0, Date.now() - this._gameState.pausedAt);
    }

    this._gameState.pausedAt = null;
  }

  public isPlayerMuted(playerId: number) {
    const player = this.getPlayer(playerId, { fetchDisconnected: true });

    if (!player) {
      return false;
    }

    return player.isMuted;
  }

  public get showman() {
    return this._players.find((p) => p.role === PlayerRole.SHOWMAN);
  }

  public isEveryoneReady() {
    if (!this.gameState.readyPlayers?.length) {
      return false;
    }

    // Consider only in-game players
    const validPlayers = this.players.filter(
      (player) =>
        player.gameStatus === PlayerGameStatus.IN_GAME && player.role === PlayerRole.PLAYER
    );

    return validPlayers.length === this.gameState.readyPlayers.length;
  }

  /**
   * @param scoreResult score delta
   * @param answerType wrong, correct or skip
   * @param nextState next question state to set
   * @returns answer result DTO that can be emitted to clients
   */
  public handleQuestionAnswer(
    scoreResult: number,
    answerType: AnswerResultType,
    nextState: QuestionState
  ): GameStateAnsweredPlayerData {
    // Use fetchDisconnected: true to handle case where answering player
    // disconnects before timer expires or showman sends result
    const { player, index } = this.getPlayerAndIndex(this.gameState.answeringPlayer!, {
      fetchDisconnected: true
    });

    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Check if current question is NoRisk type and prevent score loss
    // Clamp incoming score result to configured per-answer limit
    let modifiedScoreResult = ValueUtils.clampAbs(scoreResult, MAX_SCORE_DELTA);

    // For NoRisk questions, prevent score loss by setting negative results to 0
    if (scoreResult < 0 && this.gameState.currentQuestion?.type === PackageQuestionType.NO_RISK) {
      modifiedScoreResult = 0;
    }

    // The game's rules can make wrong answers to buzzer questions free
    if (
      scoreResult < 0 &&
      this._settings.wrongAnswerPenalty === WrongAnswerPenalty.NONE &&
      Game.BUZZER_QUESTION_TYPES.has(
        this.gameState.currentQuestion?.type ?? PackageQuestionType.SIMPLE
      )
    ) {
      modifiedScoreResult = 0;
    }

    const preClampedScore = player.score + modifiedScoreResult;
    const score = ValueUtils.clampAbs(preClampedScore, SCORE_ABS_LIMIT);

    // Update the player's score in the _players array
    if (index !== -1) {
      this._players[index].score = score;
    }

    const isCorrect = answerType === AnswerResultType.CORRECT;

    const playerAnswerResult: GameStateAnsweredPlayerData = {
      player: this.gameState.answeringPlayer!,
      result: modifiedScoreResult,
      score,
      answerType
    };

    const answeredPlayers = this.gameState.answeredPlayers || [];

    if (!isCorrect) {
      this.gameState.answeredPlayers = [...answeredPlayers, playerAnswerResult];
    } else {
      // When question is correct we reset answered players array
      this.gameState.answeredPlayers = null;
    }

    // Always reset answering player
    this.gameState.answeringPlayer = null;
    this.setQuestionState(nextState);

    return playerAnswerResult;
  }

  /**
   * Removes current question, timer and sets question state to 'choosing'
   */
  public resetToChoosingState() {
    this.gameState.currentQuestion = null;
    this.gameState.timer = null;
    this.gameState.answeredPlayers = null;
    this.gameState.answeringPlayer = null;
    this.gameState.skippedPlayers = null;
    this.gameState.answerShowData = null;
    this.gameState.secretQuestionData = null;
    this.gameState.stakeQuestionData = null;
    this.gameState.questionEligiblePlayers = null;
    this.gameState.questionContentPlan = null;
    this.gameState.mediaDurations = null;
    this.gameState.allPlay = null;
    this.setQuestionState(QuestionState.CHOOSING);
  }

  public setQuestionState(questionState: QuestionState) {
    if (this.gameState.questionState === questionState) {
      return;
    }

    this.gameState.questionState = questionState;

    // A buzzer race only lives inside SHOWING
    if (questionState !== QuestionState.SHOWING) {
      this.gameState.buzzerWindow = null;
    }

    // Buzzer timing belongs to one question's content
    if (
      questionState === QuestionState.CHOOSING ||
      questionState === QuestionState.MEDIA_DOWNLOADING ||
      questionState === QuestionState.SHOWING_ANSWER
    ) {
      this.gameState.buzzerOpensAtMs = null;
      this.gameState.buzzerLocks = null;
    }
  }

  public setTimer(timer: GameStateTimerDTO | null) {
    this.gameState.timer = timer;
  }

  public get timer() {
    return this.gameState.timer;
  }

  public addSkippedPlayer(playerId: number): void {
    if ((this.gameState.skippedPlayers?.length ?? 0) < 1) {
      this.gameState.skippedPlayers = [];
    }

    if (!this.gameState.skippedPlayers!.includes(playerId)) {
      this.gameState.skippedPlayers!.push(playerId);
    }
  }

  public removeSkippedPlayer(playerId: number): void {
    if (!this.gameState.skippedPlayers) {
      return;
    }

    this.gameState.skippedPlayers = this.gameState.skippedPlayers.filter((id) => id !== playerId);

    if (this.gameState.skippedPlayers.length === 0) {
      this.gameState.skippedPlayers = null;
    }
  }

  public hasPlayerSkipped(playerId: number): boolean {
    return this.gameState.skippedPlayers?.includes(playerId) ?? false;
  }

  /**
   * True when nobody can still buzz: every player who may answer the current
   * question has either passed or already answered it. A pass after someone
   * else's wrong answer therefore ends the question instead of leaving
   * everyone waiting for the timer.
   */
  public haveAllPlayersSkipped(): boolean {
    const activePlayers = this._getAnswerEligibleInGamePlayers();
    if (activePlayers.length === 0) {
      return false;
    }

    const skippedPlayers = this.gameState.skippedPlayers ?? [];
    const answeredPlayerIds = this.gameState.answeredPlayers?.map((ap) => ap.player) ?? [];

    return activePlayers.every(
      (player) =>
        skippedPlayers.includes(player.meta.id) || answeredPlayerIds.includes(player.meta.id)
    );
  }

  /** In-game players allowed to answer the current question (late joiners excluded). */
  private _getAnswerEligibleInGamePlayers(): Player[] {
    return this.getInGamePlayers().filter((player) =>
      this.isPlayerEligibleToAnswer(player.meta.id)
    );
  }

  /**
   * Checks if all players WILL BE exhausted after the current answering player
   * is added to the exhausted list. This is used in transition handlers to determine
   * if a wrong answer should transition to SHOWING_ANSWER (all exhausted) or
   * back to SHOWING (others can still answer).
   *
   * @returns true if all players will be exhausted after the current answer is processed
   */
  public willAllPlayersBeExhausted(): boolean {
    const activePlayers = this._getAnswerEligibleInGamePlayers();
    if (activePlayers.length === 0) {
      return true;
    }

    const skippedPlayers = this.gameState.skippedPlayers ?? [];
    const answeredPlayerIds = this.gameState.answeredPlayers?.map((ap) => ap.player) ?? [];

    // Include the current answering player as if they were already exhausted
    const currentAnsweringPlayer = this.gameState.answeringPlayer;
    const willBeExhaustedIds = currentAnsweringPlayer
      ? [...answeredPlayerIds, currentAnsweringPlayer]
      : answeredPlayerIds;

    return activePlayers.every(
      (player) =>
        skippedPlayers.includes(player.meta.id) || willBeExhaustedIds.includes(player.meta.id)
    );
  }

  // =========================================================================
  // Question Eligible Players Management
  // =========================================================================

  /**
   * Captures the current in-game players as eligible to answer the question.
   * Should be called when a question is picked (transition from CHOOSING).
   * This prevents players who join mid-question from answering.
   */
  public captureQuestionEligiblePlayers(): void {
    const inGamePlayers = this.getInGamePlayers();
    this.gameState.questionEligiblePlayers = inGamePlayers.map((p) => p.meta.id);
  }

  /**
   * Checks if a player is eligible to answer the current question.
   * A player is eligible if they were present when the question started.
   *
   * @param playerId The player ID to check
   * @returns true if the player is eligible to answer, false otherwise
   */
  public isPlayerEligibleToAnswer(playerId: number): boolean {
    // If no eligible players list is set, allow everyone (backwards compatibility / edge cases)
    if (!this.gameState.questionEligiblePlayers) {
      return true;
    }

    return this.gameState.questionEligiblePlayers.includes(playerId);
  }

  /**
   * Gets the list of players eligible to answer the current question.
   * Returns null if no question is active or no eligibility check is in place.
   */
  public getQuestionEligiblePlayers(): number[] | null {
    return this.gameState.questionEligiblePlayers ?? null;
  }

  private _resolveJoinSlot(
    role: PlayerRole,
    targetSlot: number | null,
    existingSlot: number | null | undefined
  ): number | null {
    if (role !== PlayerRole.PLAYER) {
      return null;
    }

    return this._resolvePlayerJoinSlot(targetSlot, existingSlot);
  }

  private _resolvePlayerJoinSlot(
    targetSlot: number | null,
    existingSlot: number | null | undefined
  ): number {
    if (targetSlot !== null) {
      return targetSlot;
    }

    const preservedSlot = this._getPreservedReconnectSlot(existingSlot);
    if (preservedSlot !== null) {
      return preservedSlot;
    }

    return this._getFirstFreeSlotIndex();
  }

  private _getPreservedReconnectSlot(existingSlot: number | null | undefined): number | null {
    if (ValueUtils.isBad(existingSlot)) {
      return null;
    }

    return this._isSlotAvailable(existingSlot) ? existingSlot : null;
  }

  /**
   * Check if a specific slot is available (not occupied by an in-game player)
   */
  private _isSlotAvailable(slot: number): boolean {
    return !this._players.some(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameSlot === slot &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  private _getFirstFreeSlotIndex(): number {
    const occupiedSlots = this._players
      .filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameSlot !== null &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      )
      .map((p) => p.gameSlot);

    for (let i = 0; i < this._maxPlayers; i++) {
      if (!occupiedSlots.includes(i)) {
        return i;
      }
    }

    // No free slot found
    throw new ClientError(ClientResponse.GAME_IS_FULL);
  }

  public toIndexData(): GameIndexesInputDTO {
    return {
      id: this._id,
      createdAt: this._createdAt,
      isPrivate: this._isPrivate,
      title: this._title
    };
  }
}
