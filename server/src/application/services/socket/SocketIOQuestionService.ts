import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { Game } from "domain/entities/game/Game";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { type SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

export type SocketToQuestionPayloadMap = Map<
  string,
  PackageQuestionDTO | SimplePackageQuestionDTO
>;

/**
 * General use-case service for handling question-related socket operations
 *
 * TODO: This class can be removed or renamed since it does not have responsibilities of service anymore (all logic moved to use-cases)
 */
@singleton()
export class SocketIOQuestionService {
  constructor(
    private readonly socketGameContextService: SocketGameContextService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Returns a map of socket IDs to either full (for showman) or
   * simple (for others) question data
   */
  public async mapSocketToQuestionPayload(
    socketsIds: string[],
    game: Game,
    question: PackageQuestionDTO
  ): Promise<SocketToQuestionPayloadMap> {
    const fullQuestionPayload = question;
    const simpleQuestionPayload =
      GameQuestionMapper.mapToSimpleQuestion(question);

    // Map socketId to question payload
    const resultMap: SocketToQuestionPayloadMap = new Map();

    const log = this.logger.performance("Get players broadcast map", {
      prefix: LogPrefix.SOCKET,
      operationsCount: socketsIds.length,
    });

    const userDataMap =
      await this.socketGameContextService.fetchUserSocketDataBatch(socketsIds);

    log.finish();

    for (const socketId of socketsIds) {
      const userSession = userDataMap.get(socketId);

      if (!userSession) {
        continue;
      }

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
    socketsIds: string[],
    game: Game
  ): Promise<Map<string, GameStateDTO>> {
    const resultMap = new Map<string, GameStateDTO>();
    const gameState = game.gameState;

    const isFinalRound =
      gameState.currentRound?.type === PackageRoundType.FINAL;

    // If not final round, everyone gets same state
    if (!isFinalRound) {
      for (const socketId of socketsIds) {
        resultMap.set(socketId, gameState);
      }
      return resultMap;
    }

    const log = this.logger.performance("Get players broadcast map", {
      prefix: LogPrefix.SOCKET,
      operationsCount: socketsIds.length,
    });

    const userDataMap =
      await this.socketGameContextService.fetchUserSocketDataBatch(socketsIds);

    log.finish();

    // For each socket, provide appropriate game state based on role
    for (const socketId of socketsIds) {
      const userSession = userDataMap.get(socketId);

      if (!userSession) {
        continue;
      }

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
}
