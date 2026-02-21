import { type Request } from "express";
import { type Server as IOServer } from "socket.io";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { PackageService } from "application/services/package/PackageService";
import { UserService } from "application/services/user/UserService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { GameUpdateLogic } from "domain/logic/game/GameUpdateLogic";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameEvent, GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { GameUpdateValidator } from "domain/validators/GameUpdateValidator";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

/**
 * Service for game management operations.
 */
@singleton()
export class GameService {
  constructor(
    @inject(DI_TOKENS.IO) private readonly io: IOServer,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    private readonly gameRepository: GameRepository,
    private readonly userService: UserService,
    private readonly packageService: PackageService,
    private readonly storage: S3StorageService,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  public async get(
    gameId: string,
    updatedTtl?: number
  ): Promise<GameListItemDTO> {
    const log = this.logger.performance(`Game retrieval`, {
      prefix: LogPrefix.GAME,
      gameId,
      updatedTtl,
    });

    const game = await this.gameRepository.getGame(gameId, updatedTtl);

    log.finish();

    return game;
  }

  public async getGameEntity(
    gameId: string,
    updatedTtl?: number
  ): Promise<Game> {
    return this.gameRepository.getGameEntity(gameId, updatedTtl);
  }

  public async list(paginationOpts: GamePaginationOpts) {
    return this.gameRepository.getAllGames(paginationOpts);
  }

  public async delete(req: Request, gameId: string) {
    const user = await this.userService.getUserByRequest(req, {
      select: ["id"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    await this.gameRepository.deleteGame(user.id, gameId);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.DELETED,
      data: {
        id: gameId,
      },
    };

    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
  }

  /**
   * **Warning:** This method bypasses host check, so it can be used only in
   * automated flows (e.g. when everyone leaves and game is finished)
   */
  public async deleteInternally(gameId: string) {
    await this.gameRepository.deleteInternally(gameId);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.DELETED,
      data: {
        id: gameId,
      },
    };

    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
  }

  public async create(req: Request, gameData: GameCreateDTO) {
    const createdByUser = await this.userService.getUserByRequest(req, {
      select: ["id", "username"],
      relations: [],
    });

    if (!createdByUser) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    const gameDataOutput = await this.gameRepository.createGame(
      gameData,
      createdByUser
    );

    this._emitSocketGameCreated(gameDataOutput);

    return gameDataOutput;
  }

  public async update(
    req: Request,
    gameId: string,
    updateData: GameUpdateDTO
  ): Promise<GameListItemDTO> {
    const user = await this.userService.getUserByRequest(req, {
      select: ["id"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    const game = await this.gameRepository.getGameEntity(gameId);
    const previousIndexData = game.toIndexData();

    // Run all validations
    GameUpdateValidator.validateUpdatePermission(game, user.id);
    GameUpdateValidator.validatePasswordUpdate(updateData, game.isPrivate);
    GameUpdateValidator.validatePackageUpdate(updateData, game);
    GameUpdateValidator.validateMaxPlayersUpdate(updateData, game);

    // Apply updates
    GameUpdateLogic.applyBasicUpdates(game, updateData);
    GameUpdateLogic.applyPasswordUpdate(game, updateData);
    await GameUpdateLogic.applyPackageUpdate(
      game,
      updateData,
      this.packageService,
      this.storage,
      this.packageStore
    );

    await this.gameRepository.updateGameWithIndexes(game, previousIndexData);

    const gameDTO = await this.gameRepository.gameToListItemDTO(game);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.CHANGED,
      data: gameDTO,
    };

    // Update global lobby list
    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
    // Update all players currently inside the game room (game namespace)
    this.io
      .of(SOCKET_GAME_NAMESPACE)
      .to(gameId)
      .emit(SocketIOEvents.GAMES, eventDataDTO);

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
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   */
  public async getTimer(gameId: string, timerAdditional?: string) {
    return this.gameRepository.getTimer(gameId, timerAdditional);
  }

  /**
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

  /**
   * @param expire seconds to expire the lock
   */
  public async gameLock(key: string, expire: number): Promise<boolean> {
    return this.gameRepository.gameLock(key, expire);
  }

  public async gameUnlock(key: string): Promise<number> {
    return this.gameRepository.gameUnlock(key);
  }

  private _emitSocketGameCreated(gameData: GameListItemDTO) {
    const eventDataDTO: GameEventDTO = {
      event: GameEvent.CREATED,
      data: gameData,
    };

    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
  }
}
