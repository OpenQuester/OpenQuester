import { singleton } from "tsyringe";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { IGameEventBroadcastService } from "domain/interfaces/game/IGameEventBroadcastService";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/**
 * Service responsible for creating standardized game event broadcasts.
 * Centralizes event broadcasting logic to ensure consistency.
 */
@singleton()
export class GameEventBroadcastService implements IGameEventBroadcastService {
  constructor() {
    //
  }

  public createGameFinishedBroadcast(gameId: string): SocketEventBroadcast {
    return {
      event: SocketIOGameEvents.GAME_FINISHED,
      data: true,
      target: SocketBroadcastTarget.GAME,
      gameId,
    };
  }

  public createNextRoundBroadcast(
    gameState: GameStateDTO,
    gameId: string
  ): SocketEventBroadcast {
    const nextRoundPayload: GameNextRoundEventPayload = {
      gameState,
    };

    return {
      event: SocketIOGameEvents.NEXT_ROUND,
      data: nextRoundPayload,
      target: SocketBroadcastTarget.GAME,
      gameId,
      useRoleBasedBroadcast:
        gameState.currentRound?.type === PackageRoundType.FINAL,
    };
  }

  public createQuestionFinishBroadcast(
    payload: QuestionFinishEventPayload,
    gameId: string
  ): SocketEventBroadcast {
    return {
      event: SocketIOGameEvents.QUESTION_FINISH,
      data: payload,
      target: SocketBroadcastTarget.GAME,
      gameId,
    };
  }
}
