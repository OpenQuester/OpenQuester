import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";
import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { type PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { type PackageMetaDTO } from "domain/types/dto/package/packageMeta";
import { type ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { asUserId } from "domain/types/ids";

export class GameMapper {
  public static gameToListItemDTO(
    game: Game,
    createdBy: ShortUserInfo,
    packMeta: PackageMetaDTO
  ): GameListItemDTO {
    return {
      id: game.id,
      title: game.title,
      ageRestriction: game.ageRestriction,
      isPrivate: game.isPrivate,
      maxPlayers: game.maxPlayers,
      settings: game.settings,
      joinMode: game.gameState.joinMode ?? null,
      players: game.players.map((p) => ({
        id: p.meta.id,
        role: p.role,
        slot: p.gameSlot,
        status: p.gameStatus
      })),
      createdBy: { id: createdBy.id, username: createdBy.username },
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      createdAt: game.createdAt,
      currentRound: game.gameState.currentRound ? game.gameState.currentRound.order + 1 : null,
      currentQuestion: game.gameState.currentQuestion?.id ?? null,
      package: {
        id: packMeta.id!,
        title: packMeta.title,
        description: packMeta.description,
        ageRestriction: packMeta.ageRestriction as AgeRestriction,
        author: { id: packMeta.author.id, username: packMeta.author.username },
        createdAt: new Date(packMeta.createdAt),
        language: packMeta.language,
        logo: packMeta.logo as { file: PackageFileDTO } | null | undefined,
        roundsCount: game.roundsCount ?? 0,
        questionsCount: game.questionsCount ?? 0,
        tags: packMeta.tags.map((t) => t.tag)
      }
    };
  }

  /**
   * @param game Game instance
   * @returns Serialized save-ready Game object for Redis
   */
  public static serializeGameToHash(game: Game): GameRedisHashDTO {
    return {
      id: game.id,
      createdBy: game.createdBy.toString(),
      title: game.title,
      createdAt: game.createdAt.getTime().toString(),
      isPrivate: game.isPrivate ? "1" : "0",
      ageRestriction: game.ageRestriction,
      maxPlayers: game.maxPlayers.toString(),
      roundIndex: JSON.stringify(game.roundIndex),
      startedAt: game.startedAt ? game.startedAt.getTime().toString() : "",
      finishedAt: game.finishedAt ? game.finishedAt.getTime().toString() : "",
      roundsCount: game.roundsCount.toString(),
      questionsCount: game.questionsCount.toString(),
      players: JSON.stringify(game.players.map((p) => p.toDTO())),
      gameState: JSON.stringify(game.gameState),
      settings: JSON.stringify(game.settings)
    };
  }

  /**
   * @param data Redis hash data is basically object with key-value pairs of strings
   * @returns Game instance
   */
  public static deserializeGameHash(data: GameRedisHashDTO): Game {
    return new Game({
      id: data.id,
      title: data.title,
      createdBy: asUserId(parseInt(data.createdBy)),
      createdAt: new Date(parseInt(data.createdAt)),
      isPrivate: data.isPrivate === "1",
      ageRestriction: data.ageRestriction as AgeRestriction,
      maxPlayers: parseInt(data.maxPlayers),
      startedAt: data.startedAt ? new Date(parseInt(data.startedAt)) : null,
      finishedAt: data.finishedAt ? new Date(parseInt(data.finishedAt)) : null,
      roundIndex: JSON.parse(data.roundIndex),
      roundsCount: parseInt(data.roundsCount),
      questionsCount: parseInt(data.questionsCount),
      players: JSON.parse(data.players).map((p: PlayerDTO) => new Player(p)),
      gameState: JSON.parse(data.gameState),
      settings: JSON.parse(data.settings)
    });
  }
}
