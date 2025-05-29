import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
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
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerMeta } from "domain/types/socket/game/PlayerMeta";
import { Logger } from "infrastructure/utils/Logger";
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
    this._package = data.package;
    this._roundsCount = data.roundsCount;
    this._questionsCount = data.questionsCount;
    this._players = data.players;
    this._gameState = data.gameState;
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
   * @returns Whether showman slot is free
   */
  public checkShowmanSlot(): boolean {
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

    const score = player.score + scoreResult;

    // Update the player's score in the _players array
    const idx = this._players.findIndex((p) => p.meta.id === player.meta.id);
    if (idx !== -1) {
      this._players[idx].score = score;
    }

    const isCorrect = answerType === AnswerResultType.CORRECT;

    const playerAnswerResult: GameStateAnsweredPlayerData = {
      player: this.gameState.answeringPlayer!,
      result: scoreResult,
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
    Logger.error("Game join collision happened !!", "[GAME]: ");
    Logger.warn(`Slots: ${occupiedSlots}, \ngame: ${JSON.stringify(this.id)}`);
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
