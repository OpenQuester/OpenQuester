import { QuestionScriptLogic } from "domain/logic/question/QuestionScriptLogic";
import { projectScriptState, projectScriptQuestion } from "domain/mappers/projectScriptState";
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

export type SocketToQuestionPayloadMap = Map<string, PackageQuestionDTO | SimplePackageQuestionDTO>;

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
    socketIds: string[],
    game: Game,
    question: PackageQuestionDTO
  ): Promise<SocketToQuestionPayloadMap> {
    const live = game.gameState.currentQuestion;
    const resolvedQuestion =
      live?.id === question.id && live?.realPrice != null
        ? { ...question, realPrice: live.realPrice }
        : question;
    const scripted = game.gameState.scriptProgress != null;
    const activeQuestion = scripted
      ? QuestionScriptLogic.activeQuestion(game, question)
      : resolvedQuestion;
    const publicQuestion = scripted
      ? projectScriptQuestion(game.gameState, activeQuestion)
      : GameQuestionMapper.mapToSimpleQuestion(activeQuestion, true);
    const showmanQuestion = scripted
      ? projectScriptQuestion(game.gameState, activeQuestion, true)
      : activeQuestion;

    // Map socketId to question payload
    const resultMap: SocketToQuestionPayloadMap = new Map();

    const log = this.logger.performance("Get players broadcast map", {
      prefix: LogPrefix.SOCKET,
      operationsCount: socketIds.length
    });

    const userDataMap = await this.socketGameContextService
      .fetchUserSocketDataBatch(socketIds)
      .catch((error: unknown) => {
        this.logger.warn("Sending public question data after session lookup failed", {
          prefix: LogPrefix.SOCKET,
          gameId: game.id,
          error: String(error)
        });
        return new Map<string, null>();
      });

    log.finish();

    for (const socketId of socketIds) {
      const userSession = userDataMap.get(socketId);

      const player =
        userSession?.gameId === game.id
          ? game.getPlayer(userSession.id, { fetchDisconnected: false })
          : null;
      resultMap.set(socketId, player?.role === PlayerRole.SHOWMAN ? showmanQuestion : publicQuestion);
    }

    return resultMap;
  }

  public async getGameStateBroadcastMap(
    socketsIds: string[],
    game: Game
  ): Promise<Map<string, GameStateDTO>> {
    const resultMap = new Map<string, GameStateDTO>();
    const gameState = game.gameState;

    const isFinalRound = gameState.currentRound?.type === PackageRoundType.FINAL;

    // Regular states without private reveal speech share the same safe projection.
    if (
      !isFinalRound &&
      !game.gameState.scriptProgress &&
      !gameState.allPlay &&
      !gameState.answerShowData?.answerTextItems?.some((item) => item.placement === "replic")
    ) {
      const visible = projectScriptState(game);
      for (const socketId of socketsIds) {
        resultMap.set(socketId, visible);
      }
      return resultMap;
    }

    const log = this.logger.performance("Get players broadcast map", {
      prefix: LogPrefix.SOCKET,
      operationsCount: socketsIds.length
    });

    const userDataMap = await this.socketGameContextService.fetchUserSocketDataBatch(socketsIds);

    log.finish();

    // For each socket, provide appropriate game state based on role
    for (const socketId of socketsIds) {
      const userSession = userDataMap.get(socketId);

      const player =
        userSession?.gameId === game.id
          ? game.getPlayer(userSession.id, { fetchDisconnected: false })
          : null;

      resultMap.set(
        socketId,
        projectScriptState(game, player?.meta.id, player?.role === PlayerRole.SHOWMAN)
      );
    }

    return resultMap;
  }
}
