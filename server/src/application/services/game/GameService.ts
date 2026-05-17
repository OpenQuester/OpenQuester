import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { PackageService } from "application/services/package/PackageService";
import { Game } from "domain/entities/game/Game";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { GameUpdateLogic } from "domain/logic/game/GameUpdateLogic";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameEvent, GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { GameUpdateValidator } from "domain/validators/GameUpdateValidator";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";
import { PACKAGE_DETAILED_RELATIONS, PACKAGE_SELECT_FIELDS } from "domain/constants/package";
import { ValueUtils } from "domain/utils/ValueUtils";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { GameStateMapper } from "domain/mappers/GameStateMapper";

/**
 * Service for game management operations.
 */
@singleton()
export class GameService {
  constructor(
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    private readonly gameRepository: GameRepository,
    private readonly packageService: PackageService,
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  public async get(gameId: string, updatedTtl?: number): Promise<GameListItemDTO> {
    const log = this.logger.performance(`Game retrieval`, {
      prefix: LogPrefix.GAME,
      gameId,
      updatedTtl
    });

    const game = await this.gameRepository.getGame(gameId, updatedTtl);

    log.finish();

    return game;
  }

  public async getGameEntity(gameId: string, updatedTtl?: number): Promise<Game> {
    return this.gameRepository.getGameEntity(gameId, updatedTtl);
  }

  public async list(paginationOpts: GamePaginationOpts) {
    return this.gameRepository.getAllGames(paginationOpts);
  }

  public async delete(userId: number, gameId: string): Promise<void> {
    await this.gameRepository.deleteGame(userId, gameId);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.DELETED,
      data: {
        id: gameId
      }
    };

    this.realtimeGateway.publish(RealtimeEvents.toAll(SocketIOEvents.GAMES, eventDataDTO));
  }

  public async create(
    createdByUser: ShortUserInfo,
    gameData: GameCreateDTO
  ): Promise<GameListItemDTO> {
    const gameDataOutput = await this.gameRepository.createGame(gameData, createdByUser);

    await this._emitGameCreated(gameDataOutput);

    return gameDataOutput;
  }

  public async update(
    userId: number,
    gameId: string,
    updateData: GameUpdateDTO
  ): Promise<GameListItemDTO> {
    const game = await this.gameRepository.getGameEntity(gameId);
    const previousIndexData = game.toIndexData();

    // Run all validations
    GameUpdateValidator.validateUpdatePermission(game, userId);
    GameUpdateValidator.validatePasswordUpdate(updateData, game.isPrivate);
    GameUpdateValidator.validatePackageUpdate(updateData, game);
    GameUpdateValidator.validateMaxPlayersUpdate(updateData, game);

    // Apply updates
    GameUpdateLogic.applyBasicUpdates(game, updateData);
    GameUpdateLogic.applyPasswordUpdate(game, updateData);

    if (ValueUtils.isNumber(updateData.packageId) && updateData.packageId < 0) {
      const packageData = await this.packageService.getPackageRaw(
        updateData.packageId,
        PACKAGE_SELECT_FIELDS,
        PACKAGE_DETAILED_RELATIONS
      );

      if (!packageData) {
        throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      if (!packageData.author) {
        throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      const packageDTO = packageData.toDTO(this.fileUrlBuilder, {
        fetchIds: true
      });
      const counts = await this.packageService.getCountsForPackage(updateData.packageId);

      // Apply package updates
      game.roundIndex = PackageStore.buildRoundIndex(packageDTO);
      game.roundsCount = counts.roundsCount;
      game.questionsCount = counts.questionsCount;

      // Store package in Redis
      await this.packageStore.storePackage(game.id, packageDTO);

      // Reinitialize game state but preserve password
      const nextInitialGameState = GameStateMapper.initGameState();
      nextInitialGameState.password = game.gameState.password;
      game.gameState = nextInitialGameState;
    }

    await this.gameRepository.updateGameWithIndexes(game, previousIndexData);

    const gameDTO = await this.gameRepository.gameToListItemDTO(game);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.CHANGED,
      data: gameDTO
    };

    // Update global lobby list
    this.realtimeGateway.publish(RealtimeEvents.toAll(SocketIOEvents.GAMES, eventDataDTO));
    // Update all players currently inside the game room (game namespace)
    this.realtimeGateway.publish(RealtimeEvents.toRoom(gameId, SocketIOEvents.GAMES, eventDataDTO));

    return gameDTO;
  }

  public async cleanupAllGames() {
    return this.gameRepository.cleanupAllGames();
  }

  public async updateGame(game: Game) {
    return this.gameRepository.updateGame(game);
  }

  public async cleanOrphanedGames() {
    return this.gameRepository.cleanOrphanedGames();
  }

  /**
   * @param gameId game id
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   */
  public async getTimer(gameId: string, timerAdditional?: string) {
    return this.gameRepository.getTimer(gameId, timerAdditional);
  }

  /**
   * @param timer GameStateTimerDTO
   * @param gameId game id
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   * @param ttl in milliseconds
   */
  public async saveTimer(
    timer: GameStateTimerDTO,
    gameId: string,
    ttl?: number,
    timerAdditional?: string
  ) {
    return this.gameRepository.saveTimer(timer, gameId, timerAdditional, ttl);
  }

  public async clearTimer(gameId: string, timerAdditional?: string) {
    return this.gameRepository.clearTimer(gameId, timerAdditional);
  }

  private async _emitGameCreated(gameData: GameListItemDTO): Promise<void> {
    const eventDataDTO: GameEventDTO = {
      event: GameEvent.CREATED,
      data: gameData
    };

    this.realtimeGateway.publish(RealtimeEvents.toAll(SocketIOEvents.GAMES, eventDataDTO));
  }
}
