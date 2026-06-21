import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { UserService } from "application/services/user/UserService";
import { GAME_CHAT_HISTORY_RETRIEVAL_LIMIT } from "domain/constants/game";
import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { GameJoinLogic } from "domain/logic/game/GameJoinLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter, type BroadcastMutation } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  type GameJoinInputData,
  type GameJoinOutputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameValidator } from "domain/validators/GameValidator";

/**
 * Orchestrates the full player-join flow
 *
 * Total RT cost inside the Redis lock: 2 (user DB read + chat read).
 */
export class JoinGameUseCase implements GameActionHandler<GameJoinInputData, GameJoinOutputData> {
  constructor(
    private readonly userService: UserService,
    private readonly socketIOChatService: SocketIOChatService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<GameJoinInputData>
  ): Promise<ActionHandlerResult<GameJoinOutputData>> {
    const { game } = ctx;
    const { socketId, payload } = ctx.action;

    // 1. Fail-Fast: check userData is present (0 RT)
    GameValidator.validateSocketAuthenticated(ctx.userData);

    const { userData } = ctx;

    // 1b. Duplicate-join guard: reject if already in this game (0 RT)
    // userData.gameId is prefetched in the IN pipeline, no extra Redis call.
    if (userData.gameId === payload.gameId) {
      throw new ClientError(ClientResponse.ALREADY_IN_GAME);
    }

    // 2. Fail-fast game state check (0 RT)
    GameStateValidator.validateGameNotFinished(game);

    // 3. Fetch user entity from DB (1 RT)
    const user = await this.userService.get(userData.id, {
      select: ["id", "username"],
      relations: ["avatar"],
      relationSelects: {
        avatar: ["id", "filename"]
      }
    });
    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // 4. Check reconnect state and run domain validation (0 RT)
    // existingPlayer is non-null when the user was already in this game
    // (reconnecting after disconnect or rejoining after leaving).
    const existingPlayer = game.getPlayer(user.id, { fetchDisconnected: true });

    GameJoinLogic.validate({
      game,
      userId: user.id,
      role: payload.role,
      existingPlayer,
      targetSlot: payload.targetSlot,
      password: payload.password ?? undefined
    });

    // 5. Mutate in-memory game state (0 RT)
    const player = await game.addPlayer(
      { id: user.id, username: user.username, avatar: user.avatar ?? null },
      payload.role,
      payload.targetSlot
    );

    // 6. Fetch chat history for the joining socket (1 RT)
    const chatMessages = await this.socketIOChatService.getMessages(
      game.id,
      game.createdAt,
      GAME_CHAT_HISTORY_RETRIEVAL_LIMIT
    );

    // 7. Build output payload
    const gameJoinData: GameJoinOutputData = {
      meta: { title: game.title },
      players: game.players.map((p) => p.toDTO()),
      gameState: this.buildJoinVisibleGameState(game, player.role),
      chatMessages
    };

    // 8. Build broadcasts
    const joinResult = GameJoinLogic.buildResult({ game, player });

    const gameDataBroadcast: BroadcastMutation = {
      type: DataMutationType.BROADCAST,
      event: SocketIOGameEvents.GAME_DATA,
      data: gameJoinData,
      target: SocketBroadcastTarget.SOCKET,
      socketId
    };

    // 9. Declare all side-effects as mutations
    // Order matters: SAVE_GAME runs first (pipeline), then BROADCAST, then the
    // rest. See DataMutationProcessor.process() for the processing contract.
    return {
      success: true,
      data: gameJoinData,
      mutations: [
        // Persist updated game state to Redis
        DataMutationConverter.saveGameMutation(game),

        // Broadcast JOIN to all players in the room
        ...DataMutationConverter.mutationFromSocketBroadcasts(joinResult.broadcasts),

        // Send full game snapshot to the joining socket
        gameDataBroadcast,

        // Save gameId for socket session
        DataMutationConverter.updateSocketSession(socketId, user.id, payload.gameId),

        // Player statistics: init session for new players, clear leftAt for
        // reconnecting players.
        ...(GameJoinLogic.shouldInitializeStats(existingPlayer, payload.role)
          ? [DataMutationConverter.initPlayerStatsSession(payload.gameId, user.id, new Date())]
          : []),

        ...(GameJoinLogic.shouldClearLeftAt(existingPlayer, payload.role)
          ? [DataMutationConverter.clearPlayerLeftAt(payload.gameId, user.id)]
          : [])
      ],
      broadcastGame: game
    };
  }

  private buildJoinVisibleGameState(game: Game, joinedRole: PlayerRole): GameStateDTO {
    const gameState = game.gameState;
    const currentRound = this.buildJoinVisibleCurrentRound(gameState, joinedRole);
    const finalRoundData = this.buildJoinVisibleFinalRoundData(gameState);
    const currentQuestion =
      gameState.questionState === QuestionState.MEDIA_DOWNLOADING
        ? null
        : gameState.currentQuestion;

    if (
      currentRound === gameState.currentRound &&
      finalRoundData === gameState.finalRoundData &&
      currentQuestion === gameState.currentQuestion
    ) {
      return gameState;
    }

    return {
      ...gameState,
      currentRound,
      currentQuestion,
      finalRoundData
    };
  }

  private buildJoinVisibleCurrentRound(
    gameState: GameStateDTO,
    joinedRole: PlayerRole
  ): GameStateDTO["currentRound"] {
    const currentRound = gameState.currentRound;
    const canSeeFinalRoundQuestions = joinedRole === PlayerRole.SHOWMAN;

    if (currentRound?.type !== PackageRoundType.FINAL || canSeeFinalRoundQuestions) {
      return currentRound;
    }

    return {
      ...currentRound,
      themes: currentRound.themes.map((theme) => ({
        ...theme,
        questions: []
      }))
    };
  }

  private buildJoinVisibleFinalRoundData(gameState: GameStateDTO): GameStateDTO["finalRoundData"] {
    const finalRoundData = gameState.finalRoundData;

    if (finalRoundData?.phase !== FinalRoundPhase.ANSWERING) {
      return finalRoundData;
    }

    return {
      ...finalRoundData,
      // Submitted final answers stay private until review reveals all answers.
      answers: finalRoundData.answers.map((answer) => ({
        ...answer,
        answer: ""
      }))
    };
  }
}
