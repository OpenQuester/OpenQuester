import { MAX_SCORE_DELTA, SCORE_ABS_LIMIT } from "domain/constants/game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameImportDTO } from "domain/types/dto/game/GameImportDTO";
import { GameIndexesInputDTO } from "domain/types/dto/game/GameIndexesInputDTO";
import {
  GameStateAnsweredPlayerData,
  GameStateDTO,
} from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { GetPlayerOptions } from "domain/types/game/GetPlayerOptions";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerMeta } from "domain/types/socket/game/PlayerMeta";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundTurnManager } from "domain/utils/FinalRoundTurnManager";
import { type ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class Game {
  private _id: string;
  private _title: string;
  private _createdBy: number;
  private _createdAt: Date;
  private _isPrivate: boolean;
  private _ageRestriction: AgeRestriction;
  private _maxPlayers: number;
  private _startedAt: Date | null;
  private _finishedAt: Date | null;
  private _package: PackageDTO;
  private _roundsCount: number;
  private _questionsCount: number;
  private _players: Player[];
  private _gameState: GameStateDTO;
  private readonly _logger: ILogger;

  constructor(data: GameImportDTO, logger: ILogger) {
    this._id = data.id;
    this._title = data.title;
    this._createdBy = data.createdBy;
    this._createdAt = data.createdAt;
    this._isPrivate = data.isPrivate;
    this._ageRestriction = data.ageRestriction;
    this._maxPlayers = data.maxPlayers;
    this._startedAt = data.startedAt;
    this._finishedAt = data.finishedAt;
    this._package = data.package;
    this._roundsCount = data.roundsCount;
    this._questionsCount = data.questionsCount;
    this._players = data.players;
    this._gameState = data.gameState;
    this._logger = logger;
  }

  // Getters
  public get id() {
    return this._id;
  }

  public get title() {
    return this._title;
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

  public get ageRestriction() {
    return this._ageRestriction;
  }

  public get maxPlayers() {
    return this._maxPlayers;
  }

  public get startedAt() {
    return this._startedAt;
  }

  public set startedAt(startedAt: Date | null) {
    this._startedAt = startedAt;
  }

  public get packageId() {
    return this._package.id;
  }

  public get package() {
    return this._package;
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

  public async addPlayer(meta: PlayerMeta, role: PlayerRole): Promise<Player> {
    const playerData = this._players.find((p) => p.meta.id === meta.id);

    const slotIdx =
      role === PlayerRole.PLAYER ? this._getFirstFreeSlotIndex() : null;

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
        restricted: false,
      },
      score: 0,
      status: PlayerGameStatus.IN_GAME,
      slot: slotIdx,
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

  /** Get all players in game excluding showman */
  public getInGamePlayers(): Player[] {
    return this.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );
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

  public checkFreeSlot(): boolean {
    const occupiedSlots = this._players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameSlot !== null &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    ).length;
    return occupiedSlots < this._maxPlayers;
  }

  /**
   * @returns Whether showman slot is taken
   */
  public checkShowmanSlotIsTaken(): boolean {
    return this._players.some(
      (p) =>
        p.role === PlayerRole.SHOWMAN &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  public isAllQuestionsPlayed() {
    if (!this.gameState || !this.gameState.currentRound) {
      return;
    }

    const { played, all } = GameQuestionMapper.getPlayedAndAllQuestions(
      this.gameState
    );

    return all.length > 0 && played.length === all.length;
  }

  /**
   * **Important**: This method overrides some game properties and game should be
   * updated if isGameFinished is true or nextGameState is not null.
   *
   * This is method that handles game round progression on each question finish.
   * It checks if all questions are played and if so, it sets the next round
   * and returns the next game state.
   * @returns Current state. If all question played - returns next game state
   * (with next round). If all question played and no next round - game finished
   */
  public handleRoundProgression() {
    if (!this.isAllQuestionsPlayed()) {
      return { isGameFinished: false, nextGameState: null };
    }

    return this.getProgressionState();
  }

  public getNextRound() {
    if (!ValueUtils.isNumber(this.gameState.currentRound?.order)) {
      return null;
    }

    const nextRound = GameStateMapper.getGameRound(
      this.package,
      this.gameState.currentRound.order + 1
    );

    return nextRound;
  }

  public getProgressionState() {
    let nextGameState: GameStateDTO | null = null;
    let isGameFinished = false;

    const nextRound = this.getNextRound();

    if (!nextRound) {
      this.finish();
      isGameFinished = true;
    } else {
      nextGameState = GameStateMapper.getClearGameState(nextRound);
      this.gameState = nextGameState;

      if (nextRound.type === PackageRoundType.FINAL) {
        // Initialize final round data
        const finalRoundData =
          FinalRoundStateManager.initializeFinalRoundData(this);
        finalRoundData.turnOrder =
          FinalRoundTurnManager.initializeTurnOrder(this);
        const currentTurnPlayer = FinalRoundTurnManager.getCurrentTurnPlayer(
          this,
          finalRoundData.turnOrder
        );
        nextGameState.currentTurnPlayerId = currentTurnPlayer ?? undefined;
        FinalRoundStateManager.updateFinalRoundData(this, finalRoundData);
        nextGameState.finalRoundData = finalRoundData;
      } else if (nextRound.type === PackageRoundType.SIMPLE) {
        // Set current turn player to the player with the lowest score
        const inGamePlayers = this.getInGamePlayers();
        if (inGamePlayers.length > 0) {
          let minScore = inGamePlayers[0].score;
          let minPlayers = [inGamePlayers[0]];
          for (let i = 1; i < inGamePlayers.length; i++) {
            const player = inGamePlayers[i];
            if (player.score < minScore) {
              minScore = player.score;
              minPlayers = [player];
            } else if (player.score === minScore) {
              minPlayers.push(player);
            }
          }
          // If multiple players have the same lowest score, pick randomly among them
          const chosen =
            minPlayers.length === 1
              ? minPlayers[0]
              : minPlayers[Math.floor(Math.random() * minPlayers.length)];
          nextGameState.currentTurnPlayerId = chosen.meta.id;
        } else {
          nextGameState.currentTurnPlayerId = null;
        }
      }
    }

    return { isGameFinished, nextGameState };
  }

  public finish() {
    this._finishedAt = new Date();
  }

  public pause() {
    this._gameState.isPaused = true;
  }

  public unpause() {
    this._gameState.isPaused = false;
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

  public set readyPlayers(players: number[]) {
    this.gameState.readyPlayers = players;
  }

  public isEveryoneReady() {
    if (!this.gameState.readyPlayers?.length) {
      return false;
    }

    // Consider only in-game players
    const validPlayers = this.players.filter(
      (player) =>
        player.gameStatus === PlayerGameStatus.IN_GAME &&
        player.role === PlayerRole.PLAYER
    );

    return validPlayers.length === this.gameState.readyPlayers.length;
  }

  /**
   * @param question on which question player answered
   * @param nextState next question state to set
   * @param options answering options
   * @returns answer result DTO that can be emitted to clients
   */
  public handleQuestionAnswer(
    scoreResult: number,
    answerType: AnswerResultType,
    nextState: QuestionState
  ) {
    const player = this.getPlayer(this.gameState.answeringPlayer!, {
      fetchDisconnected: false,
    });

    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Check if current question is NoRisk type and prevent score loss
    // Clamp incoming score result to configured per-answer limit
    let modifiedScoreResult = ValueUtils.clampAbs(scoreResult, MAX_SCORE_DELTA);
    if (this.gameState.currentQuestion && scoreResult < 0) {
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        this._package,
        this.gameState.currentRound!.id,
        this.gameState.currentQuestion.id!
      );

      if (questionData?.question?.type === PackageQuestionType.NO_RISK) {
        // For NoRisk questions, prevent score loss by setting negative results to 0
        modifiedScoreResult = 0;
      }
    }

    const preClampedScore = player.score + modifiedScoreResult;
    const score = ValueUtils.clampAbs(preClampedScore, SCORE_ABS_LIMIT);

    // Update the player's score in the _players array
    const idx = this._players.findIndex((p) => p.meta.id === player.meta.id);
    if (idx !== -1) {
      this._players[idx].score = score;
    }

    const isCorrect = answerType === AnswerResultType.CORRECT;

    const playerAnswerResult: GameStateAnsweredPlayerData = {
      player: this.gameState.answeringPlayer!,
      result: modifiedScoreResult,
      score,
      answerType,
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
    this.updateQuestionState(nextState);

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
    this.gameState.secretQuestionData = null;
    this.gameState.stakeQuestionData = null;
    this.updateQuestionState(QuestionState.CHOOSING);
  }

  public updateQuestionState(questionState: QuestionState) {
    if (this.gameState.questionState === questionState) {
      return;
    }

    this.gameState.questionState = questionState;
  }

  public setTimer(timer: GameStateTimerDTO | null) {
    this.gameState.timer = timer;
  }

  public get timer() {
    return this.gameState.timer;
  }

  public addSkippedPlayer(playerId: number): void {
    if (!this.gameState.skippedPlayers) {
      this.gameState.skippedPlayers = [];
    }

    if (!this.gameState.skippedPlayers.includes(playerId)) {
      this.gameState.skippedPlayers.push(playerId);
      this._logger.trace("Player skipped question", {
        prefix: "[GAME]: ",
        playerId,
      });
    }
  }

  public removeSkippedPlayer(playerId: number): void {
    if (!this.gameState.skippedPlayers) {
      return;
    }

    this.gameState.skippedPlayers = this.gameState.skippedPlayers.filter(
      (id) => id !== playerId
    );

    this._logger.trace("Player unskipped question", {
      prefix: "[GAME]: ",
      playerId,
    });

    if (this.gameState.skippedPlayers.length === 0) {
      this.gameState.skippedPlayers = null;
    }
  }

  public hasPlayerSkipped(playerId: number): boolean {
    return this.gameState.skippedPlayers?.includes(playerId) ?? false;
  }

  public haveAllPlayersSkipped(): boolean {
    const activePlayers = this.getInGamePlayers();
    if (activePlayers.length === 0) {
      return false;
    }

    const skippedPlayers = this.gameState.skippedPlayers ?? [];
    return activePlayers.every((player) =>
      skippedPlayers.includes(player.meta.id)
    );
  }

  public getSkippedPlayers(): number[] {
    return this.gameState.skippedPlayers ?? [];
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

    // Inform developers in case if collision happened
    this._logger.error("Game join collision happened !!", {
      prefix: "[GAME]: ",
    });
    this._logger.warn(
      `Slots: ${occupiedSlots}, \ngame: ${JSON.stringify(this.id)}`,
      { prefix: "[GAME]: " }
    );
    return -1;
  }

  public toIndexData(): GameIndexesInputDTO {
    return {
      id: this._id,
      createdAt: this._createdAt,
      isPrivate: this._isPrivate,
      title: this._title,
    };
  }
}
