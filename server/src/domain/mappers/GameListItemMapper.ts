import { type Game } from "domain/entities/game/Game";
import { type AgeRestriction } from "domain/enums/game/AgeRestriction";
import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { type PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { type PackageMetaDTO } from "domain/types/dto/package/PackageMetaDTO";
import { type ShortUserInfo } from "domain/types/user/ShortUserInfo";

/** Builds the game card shown in game lists from a game and what it refers to. */
export class GameListItemMapper {
  public static toDTO(
    game: Game,
    createdBy: ShortUserInfo,
    packMeta: PackageMetaDTO
  ): GameListItemDTO {
    const currentRound = game.gameState.currentRound ? game.gameState.currentRound.order + 1 : null;

    const currentQuestion = game.gameState.currentQuestion ? game.gameState.currentQuestion : null;

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
      createdBy: {
        id: createdBy.id,
        username: createdBy.username
      },
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      createdAt: game.createdAt,
      currentRound,
      currentQuestion: currentQuestion?.id ?? null,
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
}
