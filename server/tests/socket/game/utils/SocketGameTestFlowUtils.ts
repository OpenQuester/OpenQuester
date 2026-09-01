import { isDeepStrictEqual } from "node:util";

import { container } from "tsyringe";

import { GAME_QUESTION_ANSWER_TIME, MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestStateUtils } from "./SocketGameTestStateUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { GameClientSocket } from "./SocketIOGameTestUtils";

interface MediaQuestionPreloadPayload {
  readonly questionId: number;
  readonly questionFiles: readonly PackageQuestionFileDTO[];
  readonly timer: GameStateTimerDTO;
}

interface QuestionPickExpectation {
  readonly event: SocketIOGameEvents;
  readonly question: PackageQuestionDTO;
}

interface ArmedQuestionReveal {
  readonly controller: AbortController;
  readonly promise: Promise<GameQuestionDataEventPayload>;
}

export class SocketGameTestFlowUtils {
  constructor(
    private stateUtils: SocketGameTestStateUtils,
    private eventUtils: SocketGameTestEventUtils,
    private userUtils: SocketGameTestUserUtils
  ) {
    //
  }

  // ============================================================================
  // MEDIA DOWNLOAD HELPERS
  // ============================================================================

  /**
   * Wait for media download phase to complete.
   */
  public async waitForMediaDownload(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<void> {
    if (playerSockets.length === 0) {
      return;
    }

    const gameState = await this._expectQuestionState(
      showmanSocket,
      QuestionState.MEDIA_DOWNLOADING,
      "acknowledge media download"
    );
    const currentQuestion = gameState.currentQuestion;
    if (!currentQuestion?.id) {
      throw new Error(
        `Cannot acknowledge media download because the current question is unavailable for game ${showmanSocket.gameId ?? "unknown"}`
      );
    }

    const expectedFiles = currentQuestion.questionFiles ?? [];
    const reveal = this._armQuestionReveal(showmanSocket, currentQuestion.id);

    try {
      await this._acknowledgeMediaDownload(showmanSocket, playerSockets);
      this._assertQuestionReveal(await reveal.promise, currentQuestion.id, expectedFiles);
      await this._expectQuestionState(
        showmanSocket,
        QuestionState.SHOWING,
        "finish media download"
      );
    } finally {
      reveal.controller.abort();
      await Promise.allSettled([reveal.promise]);
    }
  }

  private async _acknowledgeMediaDownload(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<void> {
    const timeoutMs = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS;
    const deadline = Date.now() + timeoutMs;

    for (const [index, playerSocket] of playerSockets.entries()) {
      const playerId = await this.userUtils.getUserIdFromSocket(playerSocket);
      const expectedAllPlayersReady = index === playerSockets.length - 1;
      const controller = new AbortController();
      const statusPromise = this.eventUtils.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (status) => status?.playerId === playerId,
        Math.max(1, deadline - Date.now()),
        controller.signal
      );
      void statusPromise.catch(() => undefined);

      try {
        playerSocket.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        this._assertMediaDownloadStatus(await statusPromise, playerId, expectedAllPlayersReady);
      } catch (error) {
        const failure = toError(error);
        const detail = failure.cause instanceof Error ? failure.cause : failure;
        throw new Error(
          `Media acknowledgement ${index + 1}/${playerSockets.length} failed ` +
            `(gameId=${showmanSocket.gameId ?? "unknown"}, playerId=${playerId}, ` +
            `socketId=${playerSocket.id ?? "unknown"}): ${detail.message}`,
          { cause: failure }
        );
      } finally {
        controller.abort();
        await Promise.allSettled([statusPromise]);
      }
    }
  }

  // ============================================================================
  // QUESTION PICKING
  // ============================================================================

  /**
   * Pick a question and optionally handle media download phase.
   */
  public async pickQuestion(
    showmanSocket: GameClientSocket,
    questionId?: number,
    playerSockets?: GameClientSocket[]
  ): Promise<void> {
    const actualQuestionId = await this._resolveQuestionId(showmanSocket, questionId);

    const game = await this.stateUtils.getGame(showmanSocket.gameId!);
    if (!game || !game.gameState.currentRound) {
      throw new Error(
        `Cannot pick question ${actualQuestionId}: active round is unavailable for game ${showmanSocket.gameId ?? "unknown"}`
      );
    }

    const expectation = await this._determineQuestionPickExpectation(game, actualQuestionId);

    if (expectation.event !== SocketIOGameEvents.QUESTION_PICK) {
      await this.eventUtils.emitAndWaitForEvent(showmanSocket, expectation.event, () =>
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: actualQuestionId
        })
      );
      return;
    }

    await this._pickRegularQuestion(
      showmanSocket,
      playerSockets ?? [],
      actualQuestionId,
      expectation.question
    );
  }

  private async _pickRegularQuestion(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number,
    question: PackageQuestionDTO
  ): Promise<void> {
    const expectedFiles = question.questionFiles ?? [];
    const eventOrder: SocketIOGameEvents[] = [];
    const preloadController = new AbortController();
    const preloadPromise = this.eventUtils.waitForEventMatching<MediaQuestionPreloadPayload>(
      showmanSocket,
      SocketIOGameEvents.QUESTION_PICK,
      (payload) => {
        if (payload?.questionId !== questionId) {
          return false;
        }

        eventOrder.push(SocketIOGameEvents.QUESTION_PICK);
        return true;
      },
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      preloadController.signal
    );
    const reveal = this._armQuestionReveal(showmanSocket, questionId, eventOrder);
    const noRevealPromise =
      expectedFiles.length > 0
        ? this.eventUtils.waitForNoEvent(showmanSocket, SocketIOGameEvents.QUESTION_DATA)
        : undefined;
    void preloadPromise.catch(() => undefined);
    void noRevealPromise?.catch(() => undefined);

    try {
      showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

      if (expectedFiles.length === 0) {
        const [preload, questionReveal] = await Promise.all([preloadPromise, reveal.promise]);
        this._assertQuestionPreload(preload, questionId, expectedFiles);
        this._assertQuestionReveal(questionReveal, questionId, expectedFiles);
        this._assertQuestionEventOrder(eventOrder);
        await this._expectQuestionState(
          showmanSocket,
          QuestionState.SHOWING,
          "auto-reveal a no-file question"
        );
        return;
      }

      const [preload] = await Promise.all([preloadPromise, noRevealPromise!]);
      this._assertQuestionPreload(preload, questionId, expectedFiles);
      await this._expectQuestionState(
        showmanSocket,
        QuestionState.MEDIA_DOWNLOADING,
        "wait for media readiness"
      );

      if (playerSockets.length === 0) {
        return;
      }

      await this._acknowledgeMediaDownload(showmanSocket, playerSockets);
      this._assertQuestionReveal(await reveal.promise, questionId, expectedFiles);
      this._assertQuestionEventOrder(eventOrder);
      await this._expectQuestionState(
        showmanSocket,
        QuestionState.SHOWING,
        "finish media download"
      );
    } finally {
      preloadController.abort();
      reveal.controller.abort();
      await Promise.allSettled([
        preloadPromise,
        reveal.promise,
        ...(noRevealPromise ? [noRevealPromise] : [])
      ]);
    }
  }

  /**
   * Try to get simple question first, then any available question.
   */
  private async _resolveQuestionId(
    showmanSocket: GameClientSocket,
    questionId?: number
  ): Promise<number> {
    if (questionId) {
      return questionId;
    }

    const socketUserData = await this.userUtils.getSocketUserData(showmanSocket);
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    const simpleQuestionId = await this.stateUtils.getQuestionIdByType(
      socketUserData.gameId,
      PackageQuestionType.SIMPLE
    );

    if (simpleQuestionId !== -1) {
      return simpleQuestionId;
    }

    return this.stateUtils.getFirstAvailableQuestionId(showmanSocket.gameId!);
  }

  private async _determineQuestionPickExpectation(
    game: Game,
    questionId: number
  ): Promise<QuestionPickExpectation> {
    const packageStore = container.resolve(PackageStore);
    const questionData = await packageStore.getQuestionWithTheme(game.id, questionId);
    const question = questionData?.question ?? null;

    if (!question) {
      throw new Error("Question not found in package");
    }

    let event: SocketIOGameEvents = SocketIOGameEvents.QUESTION_PICK;

    switch (question.type) {
      case PackageQuestionType.STAKE:
        event = SocketIOGameEvents.STAKE_QUESTION_PICKED;
        break;
      case PackageQuestionType.SECRET: {
        const eligiblePlayers = game.players.filter(
          (p) => p.role === PlayerRole.PLAYER && p.gameStatus === PlayerGameStatus.IN_GAME
        ).length;

        if (eligiblePlayers >= 2) {
          event = SocketIOGameEvents.SECRET_QUESTION_PICKED;
        } else {
          event = SocketIOGameEvents.QUESTION_DATA;
        }
        break;
      }
      default:
        event = SocketIOGameEvents.QUESTION_PICK;
        break;
    }

    return { event, question };
  }

  private _armQuestionReveal(
    showmanSocket: GameClientSocket,
    questionId: number,
    eventOrder?: SocketIOGameEvents[]
  ): ArmedQuestionReveal {
    const controller = new AbortController();
    const promise = this.eventUtils.waitForEventMatching<GameQuestionDataEventPayload>(
      showmanSocket,
      SocketIOGameEvents.QUESTION_DATA,
      (payload) => {
        if (payload?.data?.id !== questionId) {
          return false;
        }

        eventOrder?.push(SocketIOGameEvents.QUESTION_DATA);
        return true;
      },
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      controller.signal
    );
    void promise.catch(() => undefined);

    return { controller, promise };
  }

  private async _expectQuestionState(
    showmanSocket: GameClientSocket,
    expectedState: QuestionState,
    operation: string
  ): Promise<GameStateDTO> {
    const gameState = await this.stateUtils.getGameState(showmanSocket.gameId!);

    if (!gameState) {
      throw new Error(
        `Cannot ${operation} because game state is unavailable for game ${showmanSocket.gameId ?? "unknown"}`
      );
    }

    if (gameState.questionState !== expectedState) {
      throw new Error(
        `Cannot ${operation} for game ${showmanSocket.gameId ?? "unknown"}: ` +
          `expected ${expectedState}, received ${gameState.questionState}`
      );
    }

    return gameState;
  }

  private _assertQuestionPreload(
    payload: MediaQuestionPreloadPayload,
    questionId: number,
    expectedFiles: readonly PackageQuestionFileDTO[]
  ): void {
    if (payload?.questionId !== questionId) {
      throw new Error(
        `Question preload expected questionId=${questionId}, received ${JSON.stringify(payload)}`
      );
    }

    this._assertQuestionFiles(payload.questionFiles, expectedFiles, "preload");
    this._assertTimer(payload.timer, MEDIA_DOWNLOAD_TIMEOUT, "question preload");
  }

  private _assertQuestionReveal(
    payload: GameQuestionDataEventPayload,
    questionId: number,
    expectedFiles: readonly PackageQuestionFileDTO[]
  ): void {
    if (payload?.data?.id !== questionId) {
      throw new Error(
        `Question reveal expected questionId=${questionId}, received ${JSON.stringify(payload)}`
      );
    }

    this._assertQuestionFiles(payload.data.questionFiles ?? [], expectedFiles, "reveal");
    this._assertTimer(payload.timer, GAME_QUESTION_ANSWER_TIME, "question reveal");
  }

  private _assertQuestionFiles(
    actualFiles: readonly PackageQuestionFileDTO[] | undefined,
    expectedFiles: readonly PackageQuestionFileDTO[],
    operation: string
  ): void {
    if (!isDeepStrictEqual(actualFiles, expectedFiles)) {
      throw new Error(
        `Question ${operation} files mismatch: expected ${JSON.stringify(expectedFiles)}, ` +
          `received ${JSON.stringify(actualFiles)}`
      );
    }
  }

  private _assertMediaDownloadStatus(
    status: MediaDownloadStatusBroadcastData,
    playerId: number,
    expectedAllPlayersReady: boolean
  ): void {
    if (
      status?.playerId !== playerId ||
      status.mediaDownloaded !== true ||
      status.allPlayersReady !== expectedAllPlayersReady
    ) {
      throw new Error(
        `expected playerId=${playerId}, mediaDownloaded=true, ` +
          `allPlayersReady=${expectedAllPlayersReady}; received ${JSON.stringify(status)}`
      );
    }

    if (expectedAllPlayersReady) {
      this._assertTimer(
        status.timer ?? undefined,
        GAME_QUESTION_ANSWER_TIME,
        "final media readiness"
      );
    } else if (status.timer !== null) {
      throw new Error(
        `Partial media readiness expected timer=null, received ${JSON.stringify(status.timer)}`
      );
    }
  }

  private _assertTimer(
    timer: GameStateTimerDTO | undefined,
    expectedDurationMs: number,
    operation: string
  ): void {
    const startedAt = timer?.startedAt;
    const startedAtMs =
      startedAt instanceof Date ? startedAt.getTime() : Date.parse(String(startedAt));

    if (
      !timer ||
      timer.durationMs !== expectedDurationMs ||
      timer.elapsedMs !== 0 ||
      timer.resumedAt !== null ||
      Number.isNaN(startedAtMs)
    ) {
      throw new Error(
        `${operation} expected a fresh ${expectedDurationMs}ms timer, received ${JSON.stringify(timer)}`
      );
    }
  }

  private _assertQuestionEventOrder(eventOrder: readonly SocketIOGameEvents[]): void {
    const expectedOrder = [SocketIOGameEvents.QUESTION_PICK, SocketIOGameEvents.QUESTION_DATA];
    if (!isDeepStrictEqual(eventOrder, expectedOrder)) {
      throw new Error(
        `Question events arrived out of order: expected ${JSON.stringify(expectedOrder)}, ` +
          `received ${JSON.stringify(eventOrder)}`
      );
    }
  }

  // ============================================================================
  // ANSWERING
  // ============================================================================

  public async answerQuestion(
    playerSocket: GameClientSocket,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_ANSWER,
      () => playerSocket.emit(SocketIOGameEvents.QUESTION_ANSWER)
    );
  }

  // ============================================================================
  // ROUND PROGRESSION
  // ============================================================================

  public async progressToNextRound(showmanSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.NEXT_ROUND, () =>
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND)
    );
  }

  // ============================================================================
  // SKIPPING
  // ============================================================================

  public async skipQuestionForce(showmanSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_FINISH,
      () => showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE)
    );
  }

  /**
   * Force skip question AND complete the show answer phase.
   * Use this when you want to fully complete the skip flow.
   */
  public async skipQuestionForceComplete(showmanSocket: GameClientSocket): Promise<void> {
    const controller = new AbortController();
    const showAnswerStartPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.ANSWER_SHOW_START,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      controller.signal
    );
    void showAnswerStartPromise.catch(() => undefined);

    try {
      await this.eventUtils.emitAndWaitForEvent(
        showmanSocket,
        SocketIOGameEvents.QUESTION_FINISH,
        () => showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE)
      );
      await showAnswerStartPromise;
    } finally {
      controller.abort();
      await Promise.allSettled([showAnswerStartPromise]);
    }

    await this.skipShowAnswer(showmanSocket);
  }

  public async skipShowAnswer(showmanSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(
      showmanSocket,
      SocketIOGameEvents.ANSWER_SHOW_END,
      () => showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER)
    );
  }

  // ============================================================================
  // TURN MANAGEMENT
  // ============================================================================

  public async setCurrentTurnPlayer(
    showmanSocket: GameClientSocket,
    newTurnPlayerId: number
  ): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(
      showmanSocket,
      SocketIOGameEvents.TURN_PLAYER_CHANGED,
      () =>
        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId
        })
    );
  }

  // ============================================================================
  // PLAYER READINESS
  // ============================================================================

  public async setPlayerReady(playerSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(playerSocket, SocketIOGameEvents.PLAYER_READY, () =>
      playerSocket.emit(SocketIOGameEvents.PLAYER_READY)
    );
  }

  public async setPlayerUnready(playerSocket: GameClientSocket): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(playerSocket, SocketIOGameEvents.PLAYER_UNREADY, () =>
      playerSocket.emit(SocketIOGameEvents.PLAYER_UNREADY)
    );
  }

  public waitForPlayerReady(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return createObservedWait(() =>
      this.eventUtils.waitForEventMatching<PlayerReadinessBroadcastData>(
        socket,
        SocketIOGameEvents.PLAYER_READY,
        (data) => expectedPlayerId === undefined || data.playerId === expectedPlayerId
      )
    );
  }

  public waitForPlayerUnready(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return createObservedWait(() =>
      this.eventUtils.waitForEventMatching<PlayerReadinessBroadcastData>(
        socket,
        SocketIOGameEvents.PLAYER_UNREADY,
        (data) => expectedPlayerId === undefined || data.playerId === expectedPlayerId
      )
    );
  }

  // ============================================================================
  // PICK AND COMPLETE QUESTION (FULL FLOW)
  // ============================================================================

  /**
   * Picks and completes any type of question (regular, secret, stake, etc.).
   */
  public async pickAndCompleteQuestion(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number,
    shouldAnswer = false,
    answerType = AnswerResultType.CORRECT,
    scoreResult = 100,
    answeringPlayerIdx = 0
  ): Promise<void> {
    const socketUserData = await this.userUtils.getSocketUserData(showmanSocket);
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    const actualQuestionId = await this.resolveQuestionIdForComplete(
      socketUserData.gameId,
      questionId
    );

    const questionType = await this.determineQuestionType(socketUserData.gameId, actualQuestionId);

    if (questionType === PackageQuestionType.SECRET) {
      await this._handleSecretQuestionComplete(
        showmanSocket,
        playerSockets,
        actualQuestionId,
        shouldAnswer,
        answerType,
        scoreResult,
        answeringPlayerIdx
      );
    } else if (questionType === PackageQuestionType.STAKE) {
      await this._handleStakeQuestionComplete(
        showmanSocket,
        playerSockets,
        socketUserData.gameId,
        actualQuestionId,
        shouldAnswer,
        answerType,
        scoreResult
      );
    } else {
      await this._handleRegularQuestionComplete(
        showmanSocket,
        playerSockets,
        actualQuestionId,
        shouldAnswer,
        answerType,
        scoreResult,
        answeringPlayerIdx
      );
    }
  }

  private async resolveQuestionIdForComplete(gameId: string, questionId?: number): Promise<number> {
    if (questionId) {
      return questionId;
    }

    const simpleQuestionId = await this.stateUtils.getQuestionIdByType(
      gameId,
      PackageQuestionType.SIMPLE
    );

    return simpleQuestionId > 0
      ? simpleQuestionId
      : await this.stateUtils.getFirstAvailableQuestionId(gameId);
  }

  private async determineQuestionType(
    gameId: string,
    questionId: number
  ): Promise<PackageQuestionType | null> {
    const game = await this.stateUtils.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    let questionType: PackageQuestionType | null = null;

    if (game.gameState.currentRound) {
      for (const theme of game.gameState.currentRound.themes) {
        for (const question of theme.questions) {
          if (question.id === questionId) {
            questionType = await this.stateUtils.getQuestionTypeFromPackage(game, questionId);
            break;
          }
        }
        if (questionType) break;
      }
    }

    // Secret question fallback to simple with < 2 players
    if (questionType === PackageQuestionType.SECRET) {
      const freshGame = await this.stateUtils.getGame(gameId);
      const eligiblePlayers = freshGame.players.filter(
        (p: Player) => p.role === PlayerRole.PLAYER && p.gameStatus === PlayerGameStatus.IN_GAME
      ).length;

      if (eligiblePlayers < 2) {
        questionType = PackageQuestionType.SIMPLE;
      }
    }

    return questionType;
  }

  // ============================================================================
  // SECRET QUESTION COMPLETE FLOW
  // ============================================================================

  private async _handleSecretQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number,
    answeringPlayerIdx: number
  ): Promise<void> {
    await this.eventUtils.emitAndWaitForEvent(
      playerSockets[answeringPlayerIdx],
      SocketIOGameEvents.SECRET_QUESTION_PICKED,
      () => showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
    );

    if (!shouldAnswer) {
      await this.skipQuestionForceComplete(showmanSocket);
      return;
    }

    await this.transferSecretQuestion(showmanSocket, playerSockets[answeringPlayerIdx]);

    await this._submitAnswerResultWithQuestionComplete(
      showmanSocket,
      playerSockets[answeringPlayerIdx],
      answerType,
      scoreResult
    );
  }

  private async transferSecretQuestion(
    showmanSocket: GameClientSocket,
    targetPlayerSocket: GameClientSocket
  ): Promise<void> {
    const targetPlayerId = await this.userUtils.getPlayerUserIdFromSocket(targetPlayerSocket);
    await this.eventUtils.emitAndWaitForEvent(
      targetPlayerSocket,
      SocketIOGameEvents.QUESTION_DATA,
      () => showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, { targetPlayerId })
    );
  }

  // ============================================================================
  // STAKE QUESTION COMPLETE FLOW
  // ============================================================================

  private async _handleStakeQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    gameId: string,
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number
  ): Promise<void> {
    const freshGame = await this.stateUtils.getGame(gameId);
    if (!freshGame) {
      throw new Error(`Cannot complete stake question ${questionId}: game ${gameId} was not found`);
    }

    const activePlayerIds = freshGame.players
      .filter(
        (player) =>
          player.role === PlayerRole.PLAYER && player.gameStatus === PlayerGameStatus.IN_GAME
      )
      .map((player) => player.meta.id);
    const providedPlayerIds = await Promise.all(
      playerSockets.map((socket) => this.userUtils.getUserIdFromSocket(socket))
    );
    const activePlayerIdSet = new Set(activePlayerIds);
    const providedPlayerIdSet = new Set(providedPlayerIds);
    const missingPlayerIds = activePlayerIds.filter(
      (playerId) => !providedPlayerIdSet.has(playerId)
    );
    const unexpectedPlayerIds = providedPlayerIds.filter(
      (playerId) => !activePlayerIdSet.has(playerId)
    );
    const duplicatePlayerIds = providedPlayerIds.filter(
      (playerId, index) => providedPlayerIds.indexOf(playerId) !== index
    );

    if (
      missingPlayerIds.length > 0 ||
      unexpectedPlayerIds.length > 0 ||
      duplicatePlayerIds.length > 0
    ) {
      throw new Error(
        `Cannot complete stake question ${questionId}: provided sockets must exactly cover active ` +
          `players (gameId=${gameId}, activePlayerIds=${JSON.stringify(activePlayerIds)}, ` +
          `providedPlayerIds=${JSON.stringify(providedPlayerIds)}, ` +
          `missingPlayerIds=${JSON.stringify(missingPlayerIds)}, ` +
          `unexpectedPlayerIds=${JSON.stringify(unexpectedPlayerIds)}, ` +
          `duplicatePlayerIds=${JSON.stringify(duplicatePlayerIds)})`
      );
    }

    await this.eventUtils.emitAndWaitForEvent(
      showmanSocket,
      SocketIOGameEvents.STAKE_QUESTION_PICKED,
      () => showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
    );

    if (!shouldAnswer) {
      await this.skipQuestionForceComplete(showmanSocket);
      return;
    }

    const winnerSocket = await this.completeBiddingPhase(
      showmanSocket,
      playerSockets,
      gameId,
      questionId
    );

    await this._submitAnswerResultWithQuestionComplete(
      showmanSocket,
      winnerSocket,
      answerType,
      scoreResult
    );
  }

  private async completeBiddingPhase(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    gameId: string,
    questionId: number
  ): Promise<GameClientSocket> {
    const controller = new AbortController();
    const stakeWinnerPromise = this.eventUtils.waitForEvent<StakeQuestionWinnerEventData>(
      showmanSocket,
      SocketIOGameEvents.STAKE_QUESTION_WINNER,
      TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
      controller.signal
    );
    void stakeWinnerPromise.catch(() => undefined);

    try {
      const game = await this.stateUtils.getGame(gameId);
      if (game?.gameState.stakeQuestionData) {
        const biddingOrder = game.gameState.stakeQuestionData.biddingOrder;

        for (let i = 0; i < biddingOrder.length; i++) {
          const playerId = biddingOrder[i];
          const playerSocket = await this.findPlayerSocket(playerSockets, playerId);

          if (playerSocket) {
            let bidType = StakeBidType.PASS;
            let bidAmount: number | null = null;

            if (i === 0) {
              const packageStore = container.resolve(PackageStore);
              const questionData = await packageStore.getQuestionWithTheme(gameId, questionId);
              const question = questionData?.question ?? null;

              const nominalAmount = question?.price || 300;
              bidType = StakeBidType.NORMAL;
              bidAmount = nominalAmount + 10;
            }

            await this.eventUtils.emitAndWaitForEvent(
              playerSocket,
              SocketIOGameEvents.STAKE_BID_SUBMIT,
              () =>
                playerSocket.emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
                  bidType,
                  bidAmount
                })
            );
          }
        }
      }

      const stakeWinnerData = await stakeWinnerPromise;

      const winnerPlayerId = stakeWinnerData?.winnerPlayerId;
      if (
        typeof winnerPlayerId !== "number" ||
        !Number.isInteger(winnerPlayerId) ||
        winnerPlayerId <= 0
      ) {
        throw new Error(
          `Stake winner event did not identify a winner ` +
            `(gameId=${gameId}, questionId=${questionId}, payload=${JSON.stringify(stakeWinnerData)})`
        );
      }

      const winnerSocket = await this.findPlayerSocket(playerSockets, winnerPlayerId);
      if (!winnerSocket) {
        throw new Error(
          `Stake winner has no provided player socket ` +
            `(gameId=${gameId}, questionId=${questionId}, winnerPlayerId=${winnerPlayerId})`
        );
      }

      return winnerSocket;
    } finally {
      controller.abort();
      await Promise.allSettled([stakeWinnerPromise]);
    }
  }

  private async findPlayerSocket(
    playerSockets: GameClientSocket[],
    playerId: number
  ): Promise<GameClientSocket | null> {
    for (const socket of playerSockets) {
      const socketUserId = await this.userUtils.getUserIdFromSocket(socket);
      if (socketUserId === playerId) {
        return socket;
      }
    }
    return null;
  }

  // ============================================================================
  // REGULAR QUESTION COMPLETE FLOW
  // ============================================================================

  private async _handleRegularQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number,
    answeringPlayerIdx: number
  ): Promise<void> {
    await this.pickQuestion(showmanSocket, questionId, playerSockets);

    if (!shouldAnswer) {
      await this.skipQuestionForceComplete(showmanSocket);
      return;
    }

    const gameState = await this.stateUtils.getGameState(showmanSocket.gameId!);
    const needsAnswer = gameState?.questionState !== QuestionState.ANSWERING;

    if (needsAnswer) {
      await this.answerQuestion(playerSockets[answeringPlayerIdx], showmanSocket);
    }

    await this._submitAnswerResultWithQuestionComplete(
      showmanSocket,
      playerSockets[answeringPlayerIdx],
      answerType,
      scoreResult
    );
  }
  // ============================================================================

  /**
   * Handles answer result and completes question forcefully if needed
   *
   * For example
   */
  private async _submitAnswerResultWithQuestionComplete(
    showmanSocket: GameClientSocket,
    answeringPlayerSocket: GameClientSocket,
    answerType: AnswerResultType,
    scoreResult: number
  ): Promise<void> {
    const controller = new AbortController();
    const answerShowStartPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.ANSWER_SHOW_START,
      TEST_TIMEOUTS.SOCKET_ACTION_TIMEOUT_MS,
      controller.signal
    );
    void answerShowStartPromise.catch(() => undefined);

    try {
      await this.eventUtils.emitAndWaitForEvent(
        answeringPlayerSocket,
        SocketIOGameEvents.ANSWER_RESULT,
        () =>
          showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
            scoreResult,
            answerType
          })
      );

      const gameAfterAnswerResult = await this.stateUtils.getGame(showmanSocket.gameId!);
      if (gameAfterAnswerResult.finishedAt) {
        return;
      }

      const gameState = gameAfterAnswerResult.gameState;

      if (gameState?.questionState === QuestionState.SHOWING_ANSWER) {
        await answerShowStartPromise;
        await this.skipShowAnswer(showmanSocket);
      } else if (gameState?.questionState === QuestionState.SHOWING) {
        await this.skipQuestionForceComplete(showmanSocket);
      } else {
        throw new Error(
          `Cannot complete answer result for game ${showmanSocket.gameId ?? "unknown"}: ` +
            `expected ${QuestionState.SHOWING_ANSWER} or ${QuestionState.SHOWING}, ` +
            `received ${gameState?.questionState ?? "missing question state"}`
        );
      }
    } finally {
      controller.abort();
      await Promise.allSettled([answerShowStartPromise]);
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createObservedWait<T>(createWait: () => Promise<T>): Promise<T> {
  try {
    return createWait();
  } catch (error) {
    const rejectedWait = Promise.reject<T>(error);
    void rejectedWait.catch(() => undefined);
    return rejectedWait;
  }
}
