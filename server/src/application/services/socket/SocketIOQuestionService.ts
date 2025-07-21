import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import {
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
} from "domain/constants/game";
import { REDIS_LOCK_QUESTION_ANSWER } from "domain/constants/redis";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { GameStateValidator } from "domain/validators/GameStateValidator";

export class SocketIOQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    //
  }

  private _getQuestionAnswerLockKey(gameId: string) {
    return `${REDIS_LOCK_QUESTION_ANSWER}:${gameId}`;
  }

  public async handleQuestionAnswer(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    // Validation
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.ANSWER
    );
    this.socketGameValidationService.validateQuestionAnswering(
      game,
      currentPlayer!.meta.id
    );

    // Lock for question answering
    const acquired = await this.gameService.gameLock(
      this._getQuestionAnswerLockKey(game.id),
      1
    );

    if (!acquired) {
      throw new ClientError(ClientResponse.SOMEONE_ALREADY_ANSWERING);
    }

    // Save question showing timer at current state
    await this.socketGameTimerService.saveElapsedTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      QuestionState.SHOWING
    );

    // Setup and set answering timer
    const timer = await this.socketQuestionStateService.setupAnsweringTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      currentPlayer!.meta.id
    );

    return {
      userId: currentPlayer?.meta.id,
      gameId: game.id,
      timer,
    };
  }

  public async handleAnswerSubmitted(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);

    if (game.gameState.answeringPlayer !== currentPlayer?.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }

    return game;
  }

  public async handleAnswerResult(socketId: string, data: AnswerResultData) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.RESULT
    );

    const isCorrect = data.answerType === AnswerResultType.CORRECT;

    // Keep showing question on Wrong answer or on answer skip
    const nextState = isCorrect
      ? QuestionState.CHOOSING
      : QuestionState.SHOWING;

    const playerAnswerResult = game.handleQuestionAnswer(
      data.scoreResult,
      data.answerType,
      nextState
    );

    let question = null;

    if (
      isCorrect &&
      game.gameState.currentRound?.type === PackageRoundType.SIMPLE
    ) {
      // Update current turn player ID to the one who answered correctly
      const answeringPlayerId = playerAnswerResult.player;
      game.gameState.currentTurnPlayerId = answeringPlayerId;
    }

    if (isCorrect) {
      question = await this.getCurrentQuestion(game);
      game.gameState.currentQuestion = null;
    }

    let timer: GameStateTimerDTO | null = null;

    if (nextState === QuestionState.SHOWING) {
      timer = await this.gameService.getTimer(game.id, QuestionState.SHOWING);
    }

    game.setTimer(timer);
    await this.gameService.updateGame(game);
    if (timer) {
      await this.gameService.saveTimer(
        timer,
        game.id,
        timer.durationMs - timer.elapsedMs
      );
    } else {
      await this.gameService.clearTimer(game.id);
    }

    return {
      playerAnswerResult,
      game,
      question,
      timer,
    };
  }

  public async handleRoundProgression(game: Game) {
    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    const { isGameFinished, nextGameState } =
      await roundHandler.handleRoundProgression(game, { forced: false });

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    return { isGameFinished, nextGameState };
  }

  public async handleQuestionSkip(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;
    const gameState = game.gameState;

    // Validation
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.SKIP
    );
    this.socketGameValidationService.validateQuestionSkipping(game);

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound!.id,
      gameState.currentQuestion!.id!
    );

    if (!questionData?.question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    await this.socketQuestionStateService.resetToChoosingState(game);
    return { game, question: questionData.question };
  }

  public async handlePlayerSkip(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Validation
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionSkipping(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.PLAYER_SKIP
    );

    // Check if player is currently answering - they can't skip while answering
    if (game.gameState.answeringPlayer === currentPlayer.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SKIP_WHILE_ANSWERING);
    }

    // Check if player has already answered this question
    const hasAnswered = game.gameState.answeredPlayers?.some(
      (answeredPlayer) => answeredPlayer.player === currentPlayer.meta.id
    );

    if (hasAnswered) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED_QUESTION);
    }

    // Add player to skipped players list
    game.addSkippedPlayer(currentPlayer.meta.id);
    await this.gameService.updateGame(game);

    return { game, playerId: currentPlayer.meta.id };
  }

  public async handlePlayerUnskip(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    // Validation
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionUnskipping(game);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    if (!game.hasPlayerSkipped(currentPlayer.meta.id)) {
      throw new ClientError(ClientResponse.PLAYER_NOT_SKIPPED);
    }

    // Remove player from skipped players list
    game.removeSkippedPlayer(currentPlayer.meta.id);
    await this.gameService.updateGame(game);

    return { game, playerId: currentPlayer.meta.id };
  }

  public async handleQuestionPick(socketId: string, questionId: number) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.PICK
    );
    this.socketGameValidationService.validateQuestionPicking(game);

    const currentRound = game.gameState.currentRound!;

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      currentRound.id,
      questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const { question, theme } = questionData;

    if (GameQuestionMapper.isQuestionPlayed(game, question.id!, theme.id!)) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PLAYED);
    }

    let isSecretQuestion = false;
    let timer: GameStateTimer | null = null;
    let secretQuestionData: SecretQuestionGameData | null = null;

    if (question.type === PackageQuestionType.SECRET) {
      isSecretQuestion = true;

      // Set up secret question data
      secretQuestionData = {
        pickerPlayerId: currentPlayer!.meta.id,
        transferType: question.transferType!,
        questionId: question.id!,
        transferPhase: true,
      } satisfies SecretQuestionGameData;

      // Set the game state to secret transfer phase
      game.gameState.questionState = QuestionState.SECRET_TRANSFER;
      game.gameState.secretQuestionData = secretQuestionData;
    } else {
      // Normal question flow - set up timer and showing state
      timer = await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.SHOWING
      );
    }

    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
      questionData.question
    );
    GameQuestionMapper.setQuestionPlayed(game, question.id!, theme.id!);

    await this.gameService.updateGame(game);

    return {
      question,
      game,
      timer,
      secretQuestionData,
      isSecretQuestion,
    };
  }

  public async getCurrentQuestion(game: Game) {
    const gameState = game.gameState;

    if (!gameState.currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    if (!gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound.id,
      gameState.currentQuestion.id!
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const { question } = questionData;

    return question;
  }

  public async getPlayersBroadcastMap(
    socketsIds: string[],
    game: Game,
    question: PackageQuestionDTO
  ) {
    const fullQuestionPayload = question;
    const simpleQuestionPayload =
      GameQuestionMapper.mapToSimpleQuestion(question);

    const resultMap: Map<
      string,
      PackageQuestionDTO | SimplePackageQuestionDTO
    > = new Map();

    const userDataPromises = socketsIds.map((socketId) =>
      this.socketGameContextService
        .fetchUserSocketData(socketId)
        .then((userSession) => ({
          socketId,
          userSession,
        }))
    );

    const userDataResults = await Promise.all(userDataPromises);

    for (const { socketId, userSession } of userDataResults) {
      const player = game.getPlayer(userSession.id, {
        fetchDisconnected: false,
      });

      if (player?.role === PlayerRole.SHOWMAN) {
        resultMap.set(socketId, fullQuestionPayload);
      } else {
        resultMap.set(socketId, simpleQuestionPayload);
      }
    }

    return resultMap;
  }

  public async getGameStateBroadcastMap(
    socketIds: string[],
    game: Game,
    gameState: GameStateDTO
  ): Promise<Map<string, GameStateDTO>> {
    // SocketID to GameStateDTO map
    const resultMap = new Map<string, GameStateDTO>();

    const isFinalRound =
      gameState.currentRound?.type === PackageRoundType.FINAL;

    // If not final round, everyone gets same state
    if (!isFinalRound) {
      for (const socketId of socketIds) {
        resultMap.set(socketId, gameState);
      }
      return resultMap;
    }

    const userDataPromises = socketIds.map((socketId) =>
      this.socketGameContextService
        .fetchUserSocketData(socketId)
        .then((userSession) => ({
          socketId,
          userSession,
        }))
    );

    const userDataResults = await Promise.all(userDataPromises);

    // For each socket, provide appropriate game state based on role
    for (const { socketId, userSession } of userDataResults) {
      const player = game.getPlayer(userSession.id, {
        fetchDisconnected: false,
      });

      if (player?.role === PlayerRole.SHOWMAN) {
        // Showman gets full data
        resultMap.set(socketId, gameState);
      } else {
        // Players and spectators get filtered data (no questions)
        const playerGameState = { ...gameState };

        // Only modify the currentRound part if it exists
        if (playerGameState.currentRound) {
          playerGameState.currentRound = {
            ...playerGameState.currentRound,
            themes: playerGameState.currentRound.themes.map((theme) => ({
              ...theme,
              questions: [], // Players get empty questions array
            })),
          };
        }

        resultMap.set(socketId, playerGameState);
      }
    }

    return resultMap;
  }

  /**
   * Handle automatic question skip when all players have skipped
   * This method bypasses socket-based authorization checks since it's triggered automatically
   * @param game - Game instance
   * @returns Game instance and question data
   */
  public async handleAutomaticQuestionSkip(game: Game) {
    const gameState = game.gameState;

    // Basic validation - game must be in progress and have a current question
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionSkipping(game);

    if (!gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound!.id,
      gameState.currentQuestion.id!
    );

    if (!questionData?.question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Reset to choosing state
    await this.socketQuestionStateService.resetToChoosingState(game);

    return { game, question: questionData.question };
  }

  /**
   * Handle secret question transfer to target player
   */
  public async handleSecretQuestionTransfer(
    socketId: string,
    data: SecretQuestionTransferInputData
  ) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    // Validation
    GameStateValidator.validateGameInProgress(game);
    const secretData = game.gameState.secretQuestionData;
    this.validateSecretQuestionTransfer(
      game,
      currentPlayer,
      secretData ?? null,
      data.targetPlayerId
    );

    // Set up the question for normal play with the target player as answering player
    const timer = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      GAME_QUESTION_ANSWER_TIME,
      QuestionState.SHOWING
    );

    // Clear secret question data and set normal question state
    game.gameState.secretQuestionData = null;
    game.gameState.questionState = QuestionState.SHOWING;

    await this.gameService.updateGame(game);

    return {
      game,
      fromPlayerId: currentPlayer!.meta.id,
      toPlayerId: data.targetPlayerId,
      questionId: secretData!.questionId,
      timer,
    };
  }

  /**
   * Validate secret question transfer constraints
   */
  private validateSecretQuestionTransfer(
    game: Game,
    currentPlayer: Player | null,
    secretData: SecretQuestionGameData | null,
    targetPlayerId: number
  ) {
    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    if (game.gameState.questionState !== QuestionState.SECRET_TRANSFER) {
      throw new ClientError(ClientResponse.GAME_NOT_IN_SECRET_TRANSFER_PHASE);
    }

    if (!secretData) {
      throw new ClientError(ClientResponse.SECRET_QUESTION_DATA_NOT_FOUND);
    }

    // Only the picker can transfer the question
    if (secretData.pickerPlayerId !== currentPlayer.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_TRANSFER_SECRET_QUESTION);
    }

    // Check if target player exists and is in game
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });
    if (!targetPlayer || targetPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.INVALID_TRANSFER_TARGET);
    }

    // Check transfer type restrictions
    if (
      secretData.transferType === PackageQuestionTransferType.EXCEPT_CURRENT &&
      targetPlayerId === secretData.pickerPlayerId
    ) {
      throw new ClientError(ClientResponse.CANNOT_TRANSFER_TO_SELF);
    }
  }
}
