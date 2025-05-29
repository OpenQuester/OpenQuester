import { Socket } from "socket.io";

import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GAME_CHAT_HISTORY_RETRIEVAL_LIMIT } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { ChatMessageGamePayloadDTO } from "domain/types/dto/game/chat/ChatMessageEventPayloadDTO";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { GameJoinEventPayload } from "domain/types/socket/events/game/GameJoinEventPayload";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { GameStartEventPayload } from "domain/types/socket/events/game/GameStartEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketWrapper } from "infrastructure/socket/SocketWrapper";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SocketIOGameController {
  constructor(
    private readonly socket: Socket,
    private readonly eventEmitter: SocketIOEventEmitter,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketIOChatService: SocketIOChatService
  ) {
    this.socket.on(
      SocketIOGameEvents.JOIN,
      SocketWrapper.catchErrors<string>(this.eventEmitter, this.handleJoinLobby)
    );
    this.socket.on(
      SocketIOGameEvents.START,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleGameStart)
    );
    this.socket.on(
      SocketIOEvents.DISCONNECT,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleSocketDisconnect)
    );
    this.socket.on(
      SocketIOGameEvents.LEAVE,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleLobbyLeave)
    );
    this.socket.on(
      SocketIOEvents.CHAT_MESSAGE,
      SocketWrapper.catchErrors<string>(
        this.eventEmitter,
        this.handleChatMessage
      )
    );
    this.socket.on(
      SocketIOGameEvents.NEXT_ROUND,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleNextRound)
    );
    this.socket.on(
      SocketIOGameEvents.GAME_PAUSE,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleGamePause)
    );
    this.socket.on(
      SocketIOGameEvents.GAME_UNPAUSE,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleGameUnpause)
    );
  }

  private handleGameUnpause = async () => {
    const { game, timer } = await this.socketIOGameService.handleGameUnpause(
      this.socket.id
    );

    this.eventEmitter.emit<{ timer: GameStateTimerDTO | null }>(
      SocketIOGameEvents.GAME_UNPAUSE,
      { timer },
      {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      }
    );
  };

  private handleGamePause = async () => {
    const { game, timer } = await this.socketIOGameService.handleGamePause(
      this.socket.id
    );

    this.eventEmitter.emit<{ timer: GameStateTimerDTO | null }>(
      SocketIOGameEvents.GAME_PAUSE,
      { timer },
      {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      }
    );
  };

  private handleNextRound = async () => {
    const { game, isGameFinished, nextGameState, questionData } =
      await this.socketIOGameService.handleNextRound(this.socket.id);

    // Always emit on next round if question is playing right now
    if (questionData) {
      this.eventEmitter.emit<QuestionFinishEventPayload>(
        SocketIOGameEvents.QUESTION_FINISH,
        {
          answerFiles: questionData.answerFiles ?? null,
          answerText: questionData.answerText ?? null,
        },
        {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        }
      );
    }

    if (isGameFinished) {
      this.eventEmitter.emit(SocketIOGameEvents.GAME_FINISHED, true, {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      });
      return;
    }

    if (nextGameState) {
      // Next round if all questions played
      this.eventEmitter.emit<GameNextRoundEventPayload>(
        SocketIOGameEvents.NEXT_ROUND,
        { gameState: nextGameState },
        {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        }
      );
    }
  };

  private handleJoinLobby = async (data: any) => {
    const dto = GameValidator.validateJoinInput(data);

    if (this.socket.rooms.has(dto.gameId)) {
      throw new ClientError(ClientResponse.ALREADY_IN_GAME);
    }

    const result = await this.socketIOGameService.joinPlayer(
      dto,
      this.socket.id
    );
    const { player, game } = result;

    this.eventEmitter.emit<PlayerDTO>(SocketIOGameEvents.JOIN, player.toDTO(), {
      emitter: SocketEventEmitter.IO,
      gameId: dto.gameId,
    });

    this.eventEmitter.emit<GameJoinEventPayload>(SocketIOGameEvents.GAME_DATA, {
      meta: {
        title: game.title,
      },
      players: game.players.map((player) => player.toDTO()),
      gameState: game.gameState,
      chatMessages: await this.socketIOChatService.getMessages(
        game.id,
        game.createdAt,
        GAME_CHAT_HISTORY_RETRIEVAL_LIMIT
      ),
    });

    await this.socket.join(dto.gameId);
  };

  private handleGameStart = async () => {
    const gameDTO = await this.socketIOGameService.startGame(this.socket.id);

    this.eventEmitter.emit<GameStartEventPayload>(
      SocketIOGameEvents.START,
      {
        currentRound: gameDTO.gameState.currentRound!,
      },
      {
        emitter: SocketEventEmitter.IO,
        gameId: gameDTO.id,
      }
    );
  };

  private handleSocketDisconnect = async () => {
    try {
      await this.handleLobbyLeave();
    } finally {
      await this.socketIOGameService.removePlayerAuth(this.socket.id);
    }
  };

  private handleLobbyLeave = async () => {
    const result = await this.socketIOGameService.leaveLobby(this.socket.id);
    if (result.emit && result.data) {
      this.eventEmitter.emit<GameLeaveEventPayload>(
        SocketIOGameEvents.LEAVE,
        { user: result.data.userId },
        {
          emitter: SocketEventEmitter.IO,
          gameId: result.data.gameId,
        }
      );

      await this.socket.leave(result.data.gameId);
    }
  };

  private handleChatMessage = async (data: any) => {
    const dto = GameValidator.validateChatMessage(data);

    const result = await this.socketIOChatService.processChatMessage(
      this.socket.id,
      dto.message
    );

    this.eventEmitter.emit<ChatMessageGamePayloadDTO>(
      SocketIOEvents.CHAT_MESSAGE,
      {
        uuid: result.uuid,
        timestamp: result.timestamp,
        user: result.user,
        message: result.message,
      },
      {
        emitter: SocketEventEmitter.IO,
        gameId: result.gameId,
      }
    );
  };
}
