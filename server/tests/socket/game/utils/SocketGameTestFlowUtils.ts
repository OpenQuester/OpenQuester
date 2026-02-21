import { container } from "tsyringe";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

import { GameClientSocket } from "./SocketIOGameTestUtils";
import { SocketGameTestStateUtils } from "./SocketGameTestStateUtils";
import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { Player } from "domain/entities/game/Player";
import { Game } from "domain/entities/game/Game";

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
    let playerIndex = 0;

    if (playerSockets.length === 0) {
      return;
    }

    const gameState = await this.stateUtils.getGameState(showmanSocket.gameId!);

    if (
      !gameState ||
      gameState.questionState !== QuestionState.MEDIA_DOWNLOADING
    ) {
      // State is not MEDIA_DOWNLOADING - possible in secret and stake questions
      // since those questions has custom phase before MEDIA_DOWNLOADING
      return;
    }

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
    const actualQuestionId = await this._resolveQuestionId(
      showmanSocket,
      questionId
    );

    const game = await this.stateUtils.getGame(showmanSocket.gameId!);
    if (!game || !game.gameState.currentRound) {
      return;
    }

    const questionPickEvent = await this._determineQuestionPickEvent(
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

    if (playerSockets && playerSockets.length > 0) {
      await this.waitForMediaDownload(showmanSocket, playerSockets);
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

    if (simpleQuestionId !== -1) {
      return simpleQuestionId;
    }

    return this.stateUtils.getFirstAvailableQuestionId(showmanSocket.gameId!);
  }

  private async _determineQuestionPickEvent(
    game: Game,
    questionId: number
  ): Promise<SocketIOGameEvents> {
    const packageStore = container.resolve(PackageStore);
    const questionData = await packageStore.getQuestionWithTheme(
      game.id,
      questionId
    );
    const question = questionData?.question ?? null;

    if (!question) {
      throw new Error("Question not found in package");
    }

    let event: SocketIOGameEvents = SocketIOGameEvents.QUESTION_DATA;

    switch (question.type) {
      case PackageQuestionType.STAKE:
        event = SocketIOGameEvents.STAKE_QUESTION_PICKED;
        break;
      case PackageQuestionType.SECRET: {
        const eligiblePlayers = game.players.filter(
          (p) =>
            p.role === PlayerRole.PLAYER &&
            p.gameStatus === PlayerGameStatus.IN_GAME
        ).length;

        if (eligiblePlayers >= 2) {
          event = SocketIOGameEvents.SECRET_QUESTION_PICKED;
        }
        break;
      }
      default:
        event = SocketIOGameEvents.QUESTION_DATA;
        break;
    }

    return event;
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

  public async skipQuestionForce(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    const finishPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_FINISH
    );
    showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE);
    await finishPromise;
  }

  /**
   * Force skip question AND complete the show answer phase.
   * Use this when you want to fully complete the skip flow.
   */
  public async skipQuestionForceComplete(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    const finishPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.QUESTION_FINISH
    );
    const showAnswerStartPromise = this.eventUtils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.ANSWER_SHOW_START
    );
    showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE);
    await finishPromise;
    await showAnswerStartPromise;
    await this.skipShowAnswer(showmanSocket);
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
        scoreResult,
        answeringPlayerIdx
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
            questionType = await this.stateUtils.getQuestionTypeFromPackage(
              game,
              questionId
            );
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

  private async _handleSecretQuestionComplete(
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
      await this.skipQuestionForceComplete(showmanSocket);
      return;
    }

    await this.transferSecretQuestion(
      showmanSocket,
      playerSockets[answeringPlayerIdx]
    );

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

  private async _handleStakeQuestionComplete(
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
      (p) => p.role === PlayerRole.PLAYER
    ).length;

    // If not all player sockets provided, skip stake and recurse
    if (playerSockets.length < totalPlayerCount) {
      await this.pickQuestion(showmanSocket, questionId, playerSockets);
      await this.skipQuestionForceComplete(showmanSocket);
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
      await this.skipQuestionForceComplete(showmanSocket);
      return;
    }

    const winnerSocket = await this.completeBiddingPhase(
      showmanSocket,
      playerSockets,
      gameId,
      questionId,
      answeringPlayerIdx
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
            const packageStore = container.resolve(PackageStore);
            const questionData = await packageStore.getQuestionWithTheme(
              gameId,
              questionId
            );
            const question = questionData?.question ?? null;

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
      await this.answerQuestion(
        playerSockets[answeringPlayerIdx],
        showmanSocket
      );
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
    // Set up event listeners before emitting - both events are in the same broadcast batch
    const answerResultPromise = this.eventUtils.waitForEvent(
      answeringPlayerSocket,
      SocketIOGameEvents.ANSWER_RESULT
    );

    // Set up ANSWER_SHOW_START listener before emitting to catch it in the same batch
    // This may resolve immediately if SHOWING_ANSWER transition doesn't happen
    const answerShowStartPromise = this.eventUtils
      .waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_SHOW_START, 1000)
      .catch(() => null); // Ignore timeout - not all answers trigger SHOWING_ANSWER (therefore this will not be awaited)

    showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
      scoreResult,
      answerType,
    });

    await answerResultPromise;

    // Game state is saved before broadcasts, so state should be updated
    const gameState = await this.stateUtils.getGameState(showmanSocket.gameId!);

    // Handle case when no eligible players remain and show answer phase is started
    if (gameState?.questionState === QuestionState.SHOWING_ANSWER) {
      await answerShowStartPromise;
      await this.skipShowAnswer(showmanSocket);
    } else if (gameState?.questionState === QuestionState.SHOWING) {
      // Question is still in progress (other players can answer)
      // Force-skip to complete the question for test purposes
      await this.skipQuestionForceComplete(showmanSocket);
    }
  }
}
