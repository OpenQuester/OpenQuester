import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

import { GameClientSocket } from "./SocketIOGameTestUtils";
import { SocketGameTestStateUtils } from "./SocketGameTestStateUtils";
import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { Player } from "domain/entities/game/Player";

export class SocketGameTestFlowUtils {
  constructor(
    private stateUtils: SocketGameTestStateUtils,
    private eventUtils: SocketGameTestEventUtils,
    private userUtils: SocketGameTestUserUtils
  ) {}

  // ============================================================================
  // MEDIA DOWNLOAD HELPERS
  // ============================================================================

  /**
   * Wait for media download phase to complete.
   * EXPLAIN: Sends MEDIA_DOWNLOADED events sequentially for each player,
   * waiting for showman to receive MEDIA_DOWNLOAD_STATUS after each emission.
   * Resolves when allPlayersReady=true is received.
   */
  public async waitForMediaDownload(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<void> {
    let playerIndex = 0;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        showmanSocket.removeListener(
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          handler
        );
        reject(new Error("Timeout waiting for all players to be ready"));
      }, 15000);

      const handler = (data: MediaDownloadStatusBroadcastData) => {
        if (data.allPlayersReady === true) {
          clearTimeout(timeout);
          showmanSocket.removeListener(
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            handler
          );
          resolve();
        } else if (playerIndex < playerSockets.length) {
          playerSockets[playerIndex].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
          playerIndex++;
        }
      };

      showmanSocket.on(SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, handler);

      if (playerSockets.length > 0) {
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        playerIndex = 1;
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * EXPLAIN: Helper to check if media download is needed and handle it.
   * This was previously inlined in pickQuestion but extracted for reuse.
   * Uses polling with retries to reliably detect correct state for interaction.
   */
  private async handleMediaDownloadIfNeeded(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<void> {
    if (playerSockets.length === 0) {
      return;
    }

    // EXPLAIN: Poll up to 20 times with 100ms intervals (2s total).
    // Use a longer timeout to ensure we catch the state transition from CHOOSING.
    // We cannot proceed if the state is still CHOOSING because Skip/Answer actions would be ignored.
    const maxAttempts = 20;
    const pollInterval = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const gameState = await this.stateUtils.getGameState(
        showmanSocket.gameId!
      );

      // EXPLAIN: If state is still CHOOSING, we must wait.
      // The server is still processing the pick transition.
      if (!gameState || gameState.questionState === QuestionState.CHOOSING) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      if (gameState.questionState === QuestionState.MEDIA_DOWNLOADING) {
        await this.waitForMediaDownload(showmanSocket, playerSockets);
        return;
      }

      // EXPLAIN: If in SHOWING or ANSWERING, we are ready to proceed.
      if (
        gameState.questionState === QuestionState.SHOWING ||
        gameState.questionState === QuestionState.ANSWERING
      ) {
        return;
      }

      // Other states (e.g. SHOWING_ANSWER) might imply we missed the window or logic is flawed,
      // but we shouldn't block indefinitely.
      return;
    }

    console.warn(
      "[TEST] handleMediaDownloadIfNeeded: Timed out waiting for state change from CHOOSING"
    );
  }

  // ============================================================================
  // QUESTION PICKING
  // ============================================================================

  /**
   * Pick a question and optionally handle media download phase.
   * EXPLAIN: Restored playerSockets parameter (Option A) so that media download
   * is handled internally. This fixes tests that call pickQuestion expecting
   * the full flow including media download wait.
   */
  public async pickQuestion(
    showmanSocket: GameClientSocket,
    questionId?: number,
    playerSockets?: GameClientSocket[]
  ): Promise<void> {
    const actualQuestionId = await this.resolveQuestionId(
      showmanSocket,
      questionId
    );

    const game = await this.stateUtils.getGame(showmanSocket.gameId!);
    if (!game || !game.gameState.currentRound) {
      return;
    }

    const questionPickEvent = this.determineQuestionPickEvent(
      game,
      actualQuestionId
    );

    const questionDataPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      questionPickEvent
    );

    showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
      questionId: actualQuestionId,
    });

    await questionDataPromise;

    // EXPLAIN: Handle media download phase after picking if playerSockets provided.
    // This restores the original behavior that tests depend on.
    if (playerSockets && playerSockets.length > 0) {
      await this.handleMediaDownloadIfNeeded(showmanSocket, playerSockets);
    }
  }

  /**
   * EXPLAIN: Extracted question ID resolution logic for readability.
   */
  private async resolveQuestionId(
    showmanSocket: GameClientSocket,
    questionId?: number
  ): Promise<number> {
    if (questionId) {
      return questionId;
    }

    const socketUserData = await this.userUtils.getSocketUserData(
      showmanSocket
    );
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    const simpleQuestionId = await this.stateUtils.getQuestionIdByType(
      socketUserData.gameId,
      PackageQuestionType.SIMPLE
    );

    if (simpleQuestionId > 0) {
      return simpleQuestionId;
    }

    return this.stateUtils.getFirstAvailableQuestionId(showmanSocket.gameId!);
  }

  /**
   * EXPLAIN: Extracted event type determination for different question types.
   */
  private determineQuestionPickEvent(
    game: any,
    questionId: number
  ): SocketIOGameEvents {
    const { question } = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound.id,
      questionId
    ) ?? { question: null };

    if (!question) {
      throw new Error("Question not found in package");
    }

    if (question.type === PackageQuestionType.STAKE) {
      return SocketIOGameEvents.STAKE_QUESTION_PICKED;
    }

    if (question.type === PackageQuestionType.SECRET) {
      const eligiblePlayers = game.players.filter(
        (p: any) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      ).length;

      if (eligiblePlayers >= 2) {
        return SocketIOGameEvents.SECRET_QUESTION_PICKED;
      }
    }

    return SocketIOGameEvents.QUESTION_DATA;
  }

  // ============================================================================
  // ANSWERING
  // ============================================================================

  public async answerQuestion(
    playerSocket: GameClientSocket,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    const questionAnswerPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_ANSWER
    );

    playerSocket.emit(SocketIOGameEvents.QUESTION_ANSWER);

    return questionAnswerPromise;
  }

  // ============================================================================
  // ROUND PROGRESSION
  // ============================================================================

  public async progressToNextRound(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for NEXT_ROUND event"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        showmanSocket.removeListener(
          SocketIOGameEvents.NEXT_ROUND,
          onNextRound
        );
      };

      const onNextRound = () => {
        cleanup();
        resolve();
      };

      showmanSocket.once(SocketIOGameEvents.NEXT_ROUND, onNextRound);
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND);
    });
  }

  // ============================================================================
  // SKIPPING
  // ============================================================================

  public async skipQuestion(showmanSocket: GameClientSocket): Promise<void> {
    const finishPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_FINISH
    );
    showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE);
    await finishPromise;
  }

  public async skipShowAnswer(showmanSocket: GameClientSocket): Promise<void> {
    const endPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.ANSWER_SHOW_END
    );
    showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);
    await endPromise;
  }

  // ============================================================================
  // TURN MANAGEMENT
  // ============================================================================

  public async setCurrentTurnPlayer(
    showmanSocket: GameClientSocket,
    newTurnPlayerId: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error("TURN_PLAYER_CHANGED event not received within timeout")
        );
      }, 5000);

      showmanSocket.once(SocketIOGameEvents.TURN_PLAYER_CHANGED, () => {
        clearTimeout(timeout);
        resolve();
      });

      showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
        newTurnPlayerId,
      });
    });
  }

  // ============================================================================
  // PLAYER READINESS
  // ============================================================================

  public async setPlayerReady(playerSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve) => {
      playerSocket.once(SocketIOGameEvents.PLAYER_READY, () => {
        resolve();
      });
      playerSocket.emit(SocketIOGameEvents.PLAYER_READY);
    });
  }

  public async setPlayerUnready(playerSocket: GameClientSocket): Promise<void> {
    return new Promise((resolve) => {
      playerSocket.once(SocketIOGameEvents.PLAYER_UNREADY, () => {
        resolve();
      });
      playerSocket.emit(SocketIOGameEvents.PLAYER_UNREADY);
    });
  }

  public async waitForPlayerReady(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return new Promise((resolve) => {
      socket.once(
        SocketIOGameEvents.PLAYER_READY,
        (data: PlayerReadinessBroadcastData) => {
          if (
            expectedPlayerId === undefined ||
            data.playerId === expectedPlayerId
          ) {
            resolve(data);
          }
        }
      );
    });
  }

  public async waitForPlayerUnready(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return new Promise((resolve) => {
      socket.once(
        SocketIOGameEvents.PLAYER_UNREADY,
        (data: PlayerReadinessBroadcastData) => {
          if (
            expectedPlayerId === undefined ||
            data.playerId === expectedPlayerId
          ) {
            resolve(data);
          }
        }
      );
    });
  }

  // ============================================================================
  // PICK QUESTION FOR ANSWERING (SECRET QUESTION HANDLING)
  // ============================================================================

  /**
   * Picks a question and prepares it for answering (handles secret questions properly).
   * Returns the socket that should answer the question.
   */
  public async pickQuestionForAnswering(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number
  ): Promise<GameClientSocket> {
    const socketUserData = await this.userUtils.getSocketUserData(
      showmanSocket
    );
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    const actualQuestionId =
      questionId ??
      (await this.stateUtils.getFirstAvailableQuestionId(
        socketUserData.gameId
      ));

    const game = await this.stateUtils.getGame(socketUserData.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const questionType = this.stateUtils.getQuestionTypeFromPackage(
      game,
      actualQuestionId
    );

    if (questionType === PackageQuestionType.SECRET) {
      return this.handleSecretQuestionPick(
        showmanSocket,
        playerSockets,
        actualQuestionId
      );
    }

    // EXPLAIN: Pass playerSockets to handle media download
    await this.pickQuestion(showmanSocket, actualQuestionId, playerSockets);
    return showmanSocket;
  }

  /**
   * EXPLAIN: Extracted secret question pick logic for readability.
   */
  private async handleSecretQuestionPick(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number
  ): Promise<GameClientSocket> {
    const secretPickedPromise = this.eventUtils.waitForEvent(
      playerSockets[0],
      SocketIOGameEvents.SECRET_QUESTION_PICKED
    );

    showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
      questionId,
    });

    await secretPickedPromise;

    const questionDataPromise = this.eventUtils.waitForEvent(
      playerSockets[0],
      SocketIOGameEvents.QUESTION_DATA
    );

    showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
      targetPlayerId: await this.userUtils.getPlayerUserIdFromSocket(
        playerSockets[0]
      ),
    });

    await questionDataPromise;

    return playerSockets[0];
  }

  // ============================================================================
  // PICK AND COMPLETE QUESTION (FULL FLOW)
  // ============================================================================

  /**
   * Picks and completes any type of question (regular, secret, stake, etc.).
   * EXPLAIN: This is the main orchestration method. Decomposed into smaller
   * helper methods for each question type to improve readability.
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
    const socketUserData = await this.userUtils.getSocketUserData(
      showmanSocket
    );
    if (!socketUserData?.gameId) {
      throw new Error("Cannot determine game ID from socket");
    }

    const actualQuestionId = await this.resolveQuestionIdForComplete(
      socketUserData.gameId,
      questionId
    );

    const questionType = await this.determineQuestionType(
      socketUserData.gameId,
      actualQuestionId
    );

    // EXPLAIN: Route to appropriate handler based on question type
    if (questionType === PackageQuestionType.SECRET) {
      await this.handleSecretQuestionComplete(
        showmanSocket,
        playerSockets,
        actualQuestionId,
        shouldAnswer,
        answerType,
        scoreResult,
        answeringPlayerIdx
      );
    } else if (questionType === PackageQuestionType.STAKE) {
      await this.handleStakeQuestionComplete(
        showmanSocket,
        playerSockets,
        socketUserData.gameId,
        actualQuestionId,
        shouldAnswer,
        answerType,
        scoreResult,
        answeringPlayerIdx
      );
    } else {
      await this.handleRegularQuestionComplete(
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

  private async resolveQuestionIdForComplete(
    gameId: string,
    questionId?: number
  ): Promise<number> {
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
            questionType = this.stateUtils.getQuestionTypeFromPackage(
              game,
              questionId
            );
            break;
          }
        }
        if (questionType) break;
      }
    }

    // EXPLAIN: Secret question fallback to simple with < 2 players
    if (questionType === PackageQuestionType.SECRET) {
      const freshGame = await this.stateUtils.getGame(gameId);
      const eligiblePlayers = freshGame.players.filter(
        (p: Player) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
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

  private async handleSecretQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number,
    answeringPlayerIdx: number
  ): Promise<void> {
    const secretPickedPromise = this.eventUtils.waitForEvent(
      playerSockets[answeringPlayerIdx],
      SocketIOGameEvents.SECRET_QUESTION_PICKED
    );

    showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
      questionId,
    });

    await secretPickedPromise;

    if (!shouldAnswer) {
      await this.skipQuestionWithShowAnswer(showmanSocket);
      return;
    }

    await this.transferSecretQuestion(
      showmanSocket,
      playerSockets[answeringPlayerIdx]
    );

    await this.submitAnswerResult(
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
    const questionDataPromise = this.eventUtils.waitForEvent(
      targetPlayerSocket,
      SocketIOGameEvents.QUESTION_DATA
    );

    showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
      targetPlayerId: await this.userUtils.getPlayerUserIdFromSocket(
        targetPlayerSocket
      ),
    });

    await questionDataPromise;
  }

  // ============================================================================
  // STAKE QUESTION COMPLETE FLOW
  // ============================================================================

  private async handleStakeQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    gameId: string,
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number,
    answeringPlayerIdx: number
  ): Promise<void> {
    const freshGame = await this.stateUtils.getGame(gameId);
    const totalPlayerCount = freshGame.players.filter(
      (p: any) => p.role === PlayerRole.PLAYER
    ).length;

    // EXPLAIN: If not all player sockets provided, skip stake and recurse
    if (playerSockets.length < totalPlayerCount) {
      // EXPLAIN: Pass playerSockets to handle media download
      await this.pickQuestion(showmanSocket, questionId, playerSockets);
      await this.skipQuestion(showmanSocket);
      await this.pickAndCompleteQuestion(
        showmanSocket,
        playerSockets,
        undefined,
        shouldAnswer,
        answerType,
        scoreResult
      );
      return;
    }

    const stakePickedPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.STAKE_QUESTION_PICKED
    );

    showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
      questionId,
    });

    await stakePickedPromise;

    if (!shouldAnswer) {
      await this.skipQuestionWithShowAnswer(showmanSocket);
      return;
    }

    const winnerSocket = await this.completeBiddingPhase(
      showmanSocket,
      playerSockets,
      gameId,
      questionId,
      answeringPlayerIdx
    );

    await this.submitAnswerResult(
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
    questionId: number,
    fallbackPlayerIdx: number
  ): Promise<GameClientSocket> {
    const stakeWinnerPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.STAKE_QUESTION_WINNER
    );

    const game = await this.stateUtils.getGame(gameId);
    if (game?.gameState.stakeQuestionData) {
      const biddingOrder = game.gameState.stakeQuestionData.biddingOrder;

      for (let i = 0; i < biddingOrder.length; i++) {
        const playerId = biddingOrder[i];
        const playerSocket = await this.findPlayerSocket(
          playerSockets,
          playerId
        );

        if (playerSocket) {
          const bidPromise = this.eventUtils.waitForEvent(
            playerSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          if (i === 0) {
            const { question } = GameQuestionMapper.getQuestionAndTheme(
              game.package,
              game.gameState.currentRound!.id,
              questionId
            ) ?? { question: null };

            const nominalAmount = question?.price || 300;

            playerSocket.emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
              bidType: StakeBidType.NORMAL,
              bidAmount: nominalAmount + 10,
            });
          } else {
            playerSocket.emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
              bidType: StakeBidType.PASS,
              bidAmount: null,
            });
          }

          await bidPromise;
        }
      }
    }

    const stakeWinnerData = await stakeWinnerPromise;

    if (stakeWinnerData?.winnerPlayerId) {
      const winnerSocket = await this.findPlayerSocket(
        playerSockets,
        stakeWinnerData.winnerPlayerId
      );
      if (winnerSocket) {
        return winnerSocket;
      }
    }

    return playerSockets[fallbackPlayerIdx];
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

  private async handleRegularQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number,
    answeringPlayerIdx: number
  ): Promise<void> {
    // EXPLAIN: Pass playerSockets to handle media download - this is the key fix!
    await this.pickQuestion(showmanSocket, questionId, playerSockets);

    if (!shouldAnswer) {
      // EXPLAIN: Must skip BOTH question AND answer show phase, otherwise
      // tests hang waiting for next-round which requires show answer to complete
      await this.skipQuestionWithShowAnswer(showmanSocket);
      return;
    }

    // EXPLAIN: Check current game state - in single-player mode, the server
    // automatically sets answering player and skips buzz-in. We need to detect
    // this case and skip answerQuestion to avoid timeout waiting for an event
    // that will never come.
    const gameState = await this.stateUtils.getGameState(showmanSocket.gameId!);
    const needsBuzzIn = gameState?.questionState !== QuestionState.ANSWERING;

    if (needsBuzzIn) {
      await this.answerQuestion(
        playerSockets[answeringPlayerIdx],
        showmanSocket
      );
    }

    await this.submitAnswerResult(
      showmanSocket,
      playerSockets[answeringPlayerIdx],
      answerType,
      scoreResult
    );
  }
  // ============================================================================

  /**
   * EXPLAIN: Extracted skip + show answer logic used by multiple question types
   */
  private async skipQuestionWithShowAnswer(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    // EXPLAIN: Showman force-skip (SKIP_QUESTION_FORCE) transitions the game
    // directly to CHOOSING (or end of round/game), skipping the SHOWING_ANSWER phase entirely.
    // Therefore we do NOT need to call skipShowAnswer, and doing so causes specific timeouts
    // because the game is no longer in a valid state to skip answer showing.
    await this.skipQuestion(showmanSocket);
  }

  /**
   * EXPLAIN: Extracted answer result submission used by all question types.
   * Handles both CORRECT (skip show answer) and WRONG (wait for result) cases.
   */
  private async submitAnswerResult(
    showmanSocket: GameClientSocket,
    answeringPlayerSocket: GameClientSocket,
    answerType: AnswerResultType,
    scoreResult: number
  ): Promise<void> {
    const showAnswerStartPromise = this.eventUtils.waitForEvent(
      answeringPlayerSocket,
      SocketIOGameEvents.ANSWER_SHOW_START
    );

    showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
      scoreResult,
      answerType,
    });

    if (answerType === AnswerResultType.CORRECT) {
      await showAnswerStartPromise;
      await this.skipShowAnswer(showmanSocket);
    } else if (answerType === AnswerResultType.SKIP) {
      // EXPLAIN: For skip answers, we do not expect ANSWER_SHOW_START if the server
      // skips straight to next state. We wait for result then check state.
      await this.eventUtils.waitForEvent(
        answeringPlayerSocket,
        SocketIOGameEvents.ANSWER_RESULT
      );

      // Wait briefly for transition
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gameState = await this.stateUtils.getGameState(
        showmanSocket.gameId!
      );
      if (gameState?.questionState === QuestionState.SHOWING_ANSWER) {
        await this.skipShowAnswer(showmanSocket);
      }
    } else {
      // EXPLAIN: For wrong answers, wait for result then skip show answer
      // to prevent test hangs waiting for show answer timer
      await this.eventUtils.waitForEvent(
        answeringPlayerSocket,
        SocketIOGameEvents.ANSWER_RESULT
      );
      await showAnswerStartPromise;
      await this.skipShowAnswer(showmanSocket);
    }
  }
}
