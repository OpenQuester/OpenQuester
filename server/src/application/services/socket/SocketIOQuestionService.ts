import { GameService } from "application/services/game/GameService";
import {
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
  GAME_TTL_IN_SECONDS,
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class SocketIOQuestionService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService
  ) {
    //
  }

  public async handleQuestionAnswer(socketId: string) {
    const { game, player } = await this._fetchPlayerAndGame(socketId);

    this._validateGameStatus(game);

    if (
      player?.role === PlayerRole.SHOWMAN ||
      player?.role === PlayerRole.SPECTATOR
    ) {
      throw new ClientError(ClientResponse.YOU_CANNOT_ANSWER_QUESTION);
    }

    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }

    if (ValueUtils.isNumber(game.gameState.answeringPlayer)) {
      throw new ClientError(ClientResponse.SOMEONE_ALREADY_ANSWERING);
    }

    const isAnswered = !!game.gameState.answeredPlayers?.find(
      (answerResult) => answerResult.player === player?.meta.id
    );

    if (isAnswered) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED);
    }

    const elapsedTimer = game.gameState.timer!;

    elapsedTimer.elapsedMs =
      Date.now() - new Date(elapsedTimer.startedAt).getTime();

    await this.gameService.saveTimer(
      elapsedTimer,
      game.id,
      // Apply some additional expire time for key safety (in case of high latency)
      Math.ceil(GAME_QUESTION_ANSWER_SUBMIT_TIME * 1.5),
      QuestionState.SHOWING
    );

    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_SUBMIT_TIME);

    game.gameState.answeringPlayer = player!.meta.id;
    game.gameState.questionState = QuestionState.ANSWERING;
    game.gameState.timer = timer.start();

    await this.gameService.updateGame(game);
    await this.gameService.saveTimer(timer.value(), game.id);

    return { userId: player?.meta.id, gameId: game.id, timer };
  }

  public async handleAnswerSubmitted(socketId: string) {
    const { player, game } = await this._fetchPlayerAndGame(socketId);
    this._validateGameStatus(game);

    if (game.gameState.answeringPlayer !== player?.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }

    return game;
  }

  public async handleAnswerResult(socketId: string, data: AnswerResultData) {
    const { player, game } = await this._fetchPlayerAndGame(socketId);
    this._validateGameStatus(game);

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_SEND_ANSWER_RESULT);
    }

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
    const { isGameFinished, nextGameState } = game.handleRoundProgression();

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    return { isGameFinished, nextGameState };
  }

  public async handleQuestionSkip(socketId: string) {
    const { game, player } = await this._fetchPlayerAndGame(socketId);
    this._validateGameStatus(game);

    if (player?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_SKIP_QUESTION_FORCE);
    }

    const gameState = game.gameState;

    if (!gameState.currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    if (!gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound.id,
      gameState.currentQuestion.id!
    );

    if (!questionData?.question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    game.resetToChoosingState();
    await this.gameService.updateGame(game);
    await this.gameService.clearTimer(game.id);

    return { game, question: questionData.question };
  }

  public async handleQuestionPick(socketId: string, questionId: number) {
    const { game, player } = await this._fetchPlayerAndGame(socketId);

    this._validateGameStatus(game);

    if (
      player?.role !== PlayerRole.PLAYER &&
      player?.role !== PlayerRole.SHOWMAN
    ) {
      throw new ClientError(ClientResponse.YOU_CANNOT_PICK_QUESTION);
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    if (game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PICKED);
    }

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

    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_TIME);
    timer.start();

    await this.updateQuestionState(game, QuestionState.SHOWING, {
      withSave: false,
    });

    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
      questionData.question
    );
    game.gameState.timer = timer.value();
    GameQuestionMapper.setQuestionPlayed(game, question.id!, theme.id!);

    await this.gameService.updateGame(game);
    await this.gameService.saveTimer(timer.value(), game.id);

    return { question, game, timer };
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
      this._fetchUserSocketData(socketId).then((userData) => ({
        socketId,
        userData,
      }))
    );

    const userDataResults = await Promise.all(userDataPromises);

    for (const { socketId, userData } of userDataResults) {
      const player = game.getPlayer(userData.id, { fetchDisconnected: false });

      if (player?.role === PlayerRole.SHOWMAN) {
        resultMap.set(socketId, fullQuestionPayload);
      } else {
        resultMap.set(socketId, simpleQuestionPayload);
      }
    }

    return resultMap;
  }

  public async updateQuestionState(
    game: Game,
    questionState: QuestionState,
    opts?: {
      withSave: boolean;
    }
  ) {
    if (game.gameState.questionState === questionState) {
      return;
    }

    game.gameState.questionState = questionState;

    if (opts && opts.withSave) {
      await this.gameService.updateGame(game);
    }

    return game;
  }

  private async _fetchUserSocketData(socketId: string) {
    const userData = await this.socketUserDataService.getSocketData(socketId);

    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    return userData;
  }

  private async _fetchPlayerAndGame(socketId: string) {
    const user = await this._fetchUserSocketData(socketId);

    if (!user.gameId) {
      throw new ClientError(
        ClientResponse.GAME_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { gameId: user.gameId }
      );
    }

    const game = await this.gameService.getGameEntity(
      user.gameId,
      GAME_TTL_IN_SECONDS
    );
    const player = game.getPlayer(user.id, { fetchDisconnected: false });

    return { game, player };
  }

  private _validateGameStatus(game: Game) {
    if (game.gameState.isPaused) {
      throw new ClientError(ClientResponse.GAME_IS_PAUSED);
    }

    if (game.finishedAt !== null) {
      throw new ClientError(ClientResponse.GAME_FINISHED);
    }
  }
}
