import { PackageService } from "application/services/package/PackageService";
import { PACKAGE_DETAILED_RELATIONS } from "domain/constants/package";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { PasswordUtils } from "domain/utils/PasswordUtils";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Business logic for applying game updates.
 * Handles the mutation of game entity based on validated update data.
 */
export class GameUpdateLogic {
  /**
   * Applies basic field updates (title, privacy, age restriction, max players).
   */
  public static applyBasicUpdates(game: Game, updateData: GameUpdateDTO): void {
    if (ValueUtils.isString(updateData.title)) {
      game.title = updateData.title;
    }

    if (ValueUtils.isBoolean(updateData.isPrivate)) {
      game.isPrivate = updateData.isPrivate;
    }

    if (ValueUtils.isNumber(updateData.maxPlayers)) {
      game.maxPlayers = updateData.maxPlayers;
    }

    if (ValueUtils.isString(updateData.ageRestriction)) {
      game.ageRestriction = updateData.ageRestriction;
    }
  }

  /**
   * Applies password updates based on privacy rules:
   * - Public games: password is cleared
   * - Private games: use provided password or auto-generate if missing
   */
  public static applyPasswordUpdate(
    game: Game,
    updateData: GameUpdateDTO
  ): void {
    if (!game.isPrivate) {
      game.password = null;
      return;
    }

    const isEmpty = ValueUtils.isEmpty(updateData.password);

    if (ValueUtils.isString(updateData.password) && !isEmpty) {
      game.password = updateData.password;
      return;
    }

    if (!ValueUtils.isString(game.gameState.password) || isEmpty) {
      game.password = PasswordUtils.generateGamePassword();
      return;
    }
  }

  /**
   * Applies package update (only allowed before game start).
   * Fetches package data, updates game entity, and reinitializes game state.
   */
  public static async applyPackageUpdate(
    game: Game,
    updateData: GameUpdateDTO,
    packageService: PackageService,
    storage: S3StorageService,
    packageStore: PackageStore
  ): Promise<void> {
    if (
      !ValueUtils.isNumber(updateData.packageId) ||
      updateData.packageId < 0
    ) {
      return;
    }

    const packageData = await packageService.getPackageRaw(
      updateData.packageId,
      undefined,
      PACKAGE_DETAILED_RELATIONS
    );

    if (!packageData) {
      throw new ClientError(
        ClientResponse.PACKAGE_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (!packageData.author) {
      throw new ClientError(
        ClientResponse.PACKAGE_AUTHOR_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    const counts = await packageService.getCountsForPackage(
      updateData.packageId
    );

    const packageDTO = packageData.toDTO(storage, {
      fetchIds: true,
    });

    game.roundIndex = PackageStore.buildRoundIndex(packageDTO);
    game.roundsCount = counts.roundsCount;
    game.questionsCount = counts.questionsCount;

    // Store updated package in Redis
    await packageStore.storePackage(game.id, packageDTO);

    // Reinitialize game state but preserve password
    const nextInitialGameState = GameStateMapper.initGameState();
    nextInitialGameState.password = game.gameState.password;
    game.gameState = nextInitialGameState;
  }
}
