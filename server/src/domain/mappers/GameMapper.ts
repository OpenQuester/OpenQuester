import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { ILogger } from "infrastructure/logger/ILogger";

export class GameMapper {
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
      package: JSON.stringify(game.package),
      startedAt: game.startedAt ? game.startedAt.getTime().toString() : "",
      finishedAt: game.finishedAt ? game.finishedAt.getTime().toString() : "",
      roundsCount: game.roundsCount.toString(),
      questionsCount: game.questionsCount.toString(),
      players: JSON.stringify(game.players.map((p) => p.toDTO())),
      gameState: JSON.stringify(game.gameState),
    };
  }

  /**
   * @param data Redis hash data is basically object with key-value pairs of strings
   * @returns Game instance
   */
  public static deserializeGameHash(
    data: Record<string, string>,
    logger: ILogger
  ): Game {
    return new Game(
      {
        id: data.id,
        title: data.title,
        createdBy: parseInt(data.createdBy),
        createdAt: new Date(parseInt(data.createdAt)),
        isPrivate: data.isPrivate === "1",
        ageRestriction: data.ageRestriction as AgeRestriction,
        maxPlayers: parseInt(data.maxPlayers),
        startedAt: data.startedAt ? new Date(parseInt(data.startedAt)) : null,
        finishedAt: data.finishedAt
          ? new Date(parseInt(data.finishedAt))
          : null,
        package: JSON.parse(data.package),
        roundsCount: parseInt(data.roundsCount),
        questionsCount: parseInt(data.questionsCount),
        players: JSON.parse(data.players).map((p: PlayerDTO) => new Player(p)),
        gameState: JSON.parse(data.gameState),
      },
      logger
    );
  }
}
