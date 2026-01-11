import { type Express } from "express";
import { Socket as ClientSocket } from "socket.io-client";
import { Repository } from "typeorm";

import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import {
  GameJoinOutputData,
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { User } from "infrastructure/database/models/User";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

import { SocketGameTestEventUtils } from "./SocketGameTestEventUtils";
import { SocketGameTestUserUtils } from "./SocketGameTestUserUtils";
import { SocketGameTestStateUtils } from "./SocketGameTestStateUtils";
import { SocketGameTestLobbyUtils } from "./SocketGameTestLobbyUtils";
import { SocketGameTestFlowUtils } from "./SocketGameTestFlowUtils";

export interface GameClientSocket extends ClientSocket {
  gameId?: string;
  role?: PlayerRole;
}

export interface GameTestSetup {
  gameId: string;
  showmanSocket: GameClientSocket;
  playerSockets: GameClientSocket[];
  spectatorSockets: GameClientSocket[];
  showmanUser: User;
  playerUsers: User[];
}

export class SocketGameTestUtils {
  private serverUrl: string;

  private eventUtils: SocketGameTestEventUtils;
  private userUtils: SocketGameTestUserUtils;
  private stateUtils: SocketGameTestStateUtils;
  private lobbyUtils: SocketGameTestLobbyUtils;
  private flowUtils: SocketGameTestFlowUtils;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl + SOCKET_GAME_NAMESPACE;

    // Initialize utils
    this.eventUtils = new SocketGameTestEventUtils();
    this.userUtils = new SocketGameTestUserUtils(this.serverUrl);
    this.stateUtils = new SocketGameTestStateUtils();
    this.lobbyUtils = new SocketGameTestLobbyUtils(
      this.userUtils,
      this.eventUtils
    );
    this.flowUtils = new SocketGameTestFlowUtils(
      this.stateUtils,
      this.eventUtils,
      this.userUtils
    );
  }

  // --- Lobby / Setup Delegates ---

  public async joinGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole = PlayerRole.PLAYER
  ): Promise<string> {
    return this.lobbyUtils.joinGame(socket, gameId, role);
  }

  public async joinSpecificGame(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole
  ): Promise<void> {
    return this.lobbyUtils.joinSpecificGame(socket, gameId, role);
  }

  public async joinSpecificGameWithData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    password?: string
  ): Promise<GameJoinOutputData> {
    return this.lobbyUtils.joinSpecificGameWithData(
      socket,
      gameId,
      role,
      password
    );
  }

  public async joinGameWithPasswordExpectError(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    password?: string
  ): Promise<ErrorEventPayload> {
    return this.lobbyUtils.joinGameWithPasswordExpectError(
      socket,
      gameId,
      role,
      password
    );
  }

  public async joinGameWithSlot(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<void> {
    return this.lobbyUtils.joinGameWithSlot(socket, gameId, role, targetSlot);
  }

  public async joinGameWithSlotAndData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole,
    targetSlot: number | null
  ): Promise<any> {
    return this.lobbyUtils.joinGameWithSlotAndData(
      socket,
      gameId,
      role,
      targetSlot
    );
  }

  public async leaveGame(socket: GameClientSocket): Promise<void> {
    return this.lobbyUtils.leaveGame(socket);
  }

  public async disconnectAndCleanup(socket: GameClientSocket): Promise<void> {
    return this.lobbyUtils.disconnectAndCleanup(socket);
  }

  public async createAndLoginUser(
    userRepo: Repository<User>,
    app: Express,
    username: string
  ): Promise<{ user: User; cookie: string }> {
    return this.userUtils.createAndLoginUser(userRepo, app, username);
  }

  public async loginExistingUser(
    app: Express,
    userId: number
  ): Promise<{ cookie: string }> {
    return this.userUtils.loginExistingUser(app, userId);
  }

  public async createGameClient(
    app: Express,
    userRepo: Repository<User>
  ): Promise<{ socket: GameClientSocket; user: User; cookie: string }> {
    return this.userUtils.createGameClient(app, userRepo);
  }

  public async createSocketForExistingUser(
    app: Express,
    userId: number
  ): Promise<{ socket: GameClientSocket; cookie: string }> {
    return this.userUtils.createSocketForExistingUser(app, userId);
  }

  public async createUnauthenticatedGameClient(): Promise<GameClientSocket> {
    return this.userUtils.createUnauthenticatedGameClient();
  }

  public async setupGameTestEnvironment(
    userRepo: Repository<User>,
    app: Express,
    playerCount: number,
    spectatorCount: number,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<GameTestSetup> {
    return this.lobbyUtils.setupGameTestEnvironment(
      userRepo,
      app,
      playerCount,
      spectatorCount,
      includeFinalRound,
      additionalSimpleQuestions
    );
  }

  async createGameWithShowman(
    app: Express,
    userRepo: Repository<User>,
    includeFinalRound: boolean = true,
    additionalSimpleQuestions: number = 0
  ): Promise<{ socket: ClientSocket; gameId: string; user: User }> {
    return this.lobbyUtils.createGameWithShowman(
      app,
      userRepo,
      includeFinalRound,
      additionalSimpleQuestions
    );
  }

  public async deleteGame(
    app: Express,
    gameId: string,
    cookie: string[]
  ): Promise<void> {
    return this.lobbyUtils.deleteGame(app, gameId, cookie);
  }

  public async getSocketUserData(
    socket: GameClientSocket
  ): Promise<SocketRedisUserData | null> {
    return this.userUtils.getSocketUserData(socket);
  }

  // --- State Delegates ---

  public async getGameState(gameId: string): Promise<GameStateDTO | null> {
    return this.stateUtils.getGameState(gameId);
  }

  public async getFirstAvailableQuestionId(gameId: string): Promise<number> {
    return this.stateUtils.getFirstAvailableQuestionId(gameId);
  }

  public async getAllAvailableQuestionIds(gameId: string): Promise<number[]> {
    return this.stateUtils.getAllAvailableQuestionIds(gameId);
  }

  // --- Flow Delegates ---

  public async startGame(
    showmanSocket: GameClientSocket
  ): Promise<GameStartEventPayload> {
    return this.lobbyUtils.startGame(showmanSocket);
  }

  public async waitForMediaDownload(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<void> {
    return this.flowUtils.waitForMediaDownload(showmanSocket, playerSockets);
  }

  public async pickQuestion(
    showmanSocket: GameClientSocket,
    questionId?: number,
    playerSockets?: GameClientSocket[]
  ): Promise<void> {
    // EXPLAIN: FlowUtils.pickQuestion now handles media download internally (Option A),
    // so we just delegate directly without additional logic here
    await this.flowUtils.pickQuestion(showmanSocket, questionId, playerSockets);
  }

  public async answerQuestion(
    playerSocket: GameClientSocket,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    return this.flowUtils.answerQuestion(playerSocket, showmanSocket);
  }

  public async progressToNextRound(
    showmanSocket: GameClientSocket
  ): Promise<void> {
    return this.flowUtils.progressToNextRound(showmanSocket);
  }

  public async skipQuestion(showmanSocket: GameClientSocket): Promise<void> {
    return this.flowUtils.skipQuestion(showmanSocket);
  }

  public async skipShowAnswer(showmanSocket: GameClientSocket): Promise<void> {
    return this.flowUtils.skipShowAnswer(showmanSocket);
  }

  public async pickAndCompleteQuestion(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number,
    shouldAnswer = false,
    answerType = AnswerResultType.CORRECT,
    scoreResult = 100,
    answeringPlayerIdx = 0
  ): Promise<void> {
    return this.flowUtils.pickAndCompleteQuestion(
      showmanSocket,
      playerSockets,
      questionId,
      shouldAnswer,
      answerType,
      scoreResult,
      answeringPlayerIdx
    );
  }

  public async pickQuestionForAnswering(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    questionId?: number
  ): Promise<GameClientSocket> {
    return this.flowUtils.pickQuestionForAnswering(
      showmanSocket,
      playerSockets,
      questionId
    );
  }

  // --- Event / Misc Delegates ---

  public async getUserIdFromSocket(socket: GameClientSocket): Promise<number> {
    return this.userUtils.getUserIdFromSocket(socket);
  }

  public async pauseGame(showmanSocket: GameClientSocket): Promise<void> {
    return this.lobbyUtils.pauseGame(showmanSocket);
  }

  public async waitForActionsComplete(
    gameId: string,
    timeout: number = 5000
  ): Promise<void> {
    return this.eventUtils.waitForActionsComplete(gameId, timeout);
  }

  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    return this.lobbyUtils.cleanupGameClients(setup);
  }

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = 5000
  ): Promise<T> {
    return this.eventUtils.waitForEvent(socket, event, timeout);
  }

  public async waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = 150
  ): Promise<void> {
    return this.eventUtils.waitForNoEvent(socket, event, timeout);
  }

  public async getGameFromGameService(gameId: string): Promise<Game> {
    return this.stateUtils.getGame(gameId);
  }

  public async updateGame(game: Game): Promise<void> {
    return this.stateUtils.updateGame(game);
  }

  public async setPlayerScore(
    gameId: string,
    playerId: number,
    score: number
  ): Promise<void> {
    return this.stateUtils.setPlayerScore(gameId, playerId, score);
  }

  public async setPlayerReady(playerSocket: GameClientSocket): Promise<void> {
    return this.flowUtils.setPlayerReady(playerSocket);
  }

  public async setPlayerUnready(playerSocket: GameClientSocket): Promise<void> {
    return this.flowUtils.setPlayerUnready(playerSocket);
  }

  public async waitForPlayerReady(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return this.flowUtils.waitForPlayerReady(socket, expectedPlayerId);
  }

  public async waitForPlayerUnready(
    socket: GameClientSocket,
    expectedPlayerId?: number
  ): Promise<PlayerReadinessBroadcastData> {
    return this.flowUtils.waitForPlayerUnready(socket, expectedPlayerId);
  }

  public async areAllPlayersReady(gameId: string): Promise<boolean> {
    return this.stateUtils.areAllPlayersReady(gameId);
  }

  public async findQuestionByType(
    questionType: PackageQuestionType,
    gameId: string,
    secretTransferType?: PackageQuestionTransferType
  ): Promise<GameStateQuestionDTO | null> {
    return this.stateUtils.findQuestionByType(
      questionType,
      gameId,
      secretTransferType
    );
  }

  public async findAllQuestionsByType(
    gameState: GameStateDTO,
    questionType: PackageQuestionType,
    gameId: string
  ): Promise<GameStateQuestionDTO[]> {
    return this.stateUtils.findAllQuestionsByType(
      gameState,
      questionType,
      gameId
    );
  }

  public async getCurrentRoundQuestionCount(gameId: string): Promise<number> {
    return this.stateUtils.getCurrentRoundQuestionCount(gameId);
  }

  public async getFirstHiddenQuestionId(gameId: string): Promise<number> {
    return this.stateUtils.getFirstHiddenQuestionId(gameId);
  }

  public async getQuestionIdByType(
    gameId: string,
    questionType: PackageQuestionType
  ): Promise<number> {
    return this.stateUtils.getQuestionIdByType(gameId, questionType);
  }

  public async setCurrentTurnPlayer(
    showmanSocket: GameClientSocket,
    newTurnPlayerId: number
  ): Promise<void> {
    return this.flowUtils.setCurrentTurnPlayer(showmanSocket, newTurnPlayerId);
  }
}
