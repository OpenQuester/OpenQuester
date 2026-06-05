import { GameService } from "application/services/game/GameService";
import { UserService } from "application/services/user/UserService";
import cookieSignature from "cookie-signature";
import {
  GAME_MAX_PLAYERS,
  GAME_TITLE_MAX_CHARS,
  GAME_TITLE_MIN_CHARS
} from "domain/constants/game";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { ErrorController } from "domain/errors/ErrorController";
import { type GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { type Express } from "express";

import { type Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { S3StorageService } from "application/services/storage/S3StorageService";
import { ValueUtils } from "domain/utils/ValueUtils";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";

export class DevelopmentRestApiController {
  constructor(
    private readonly app: Express,
    private readonly userService: UserService,
    private readonly env: Environment,
    private readonly gameService: GameService,
    private readonly storage: S3StorageService,
    private readonly logger: ILogger
  ) {
    const dummyUser = {
      username: "dev-user",
      email: "dev@example.com",
      discord_id: "dev-user-discord",
      birthday: null,
      avatar: null
    };

    this.app.post("/v1/dev/login/:num", async (req, res) => {
      try {
        const num = req.params.num ? `-${req.params.num}` : "";
        this.logger.audit(`Dev login request triggered`, {
          prefix: LogPrefix.DEV,
          id: req.params.num
        });
        let user = await this.userService.findActiveByIdentity(
          {
            username: dummyUser.username + num,
            email: dummyUser.email + num,
            discordId: dummyUser.discord_id + num
          },
          {
            select: USER_SELECT_FIELDS,
            relations: USER_RELATIONS,
            relationSelects: {
              avatar: ["id", "filename"],
              permissions: ["id", "name"]
            }
          }
        );

        if (!user) {
          user = await this.userService.create({
            username: dummyUser.username + num,
            email: dummyUser.email + num,
            discord_id: dummyUser.discord_id + num,
            birthday: null,
            avatar: null
          });
        }
        req.session.userId = user.id;
        req.session.isGuest = user.is_guest;
        req.session.save((err) => {
          if (err) {
            this.logger.error(`Session save error: ${err}`, {
              prefix: LogPrefix.DEV
            });
            return res.status(500).json({ error: "Session save failed" });
          }
          // Signed session value to put it in Postman
          const signedSessionID =
            "s:" + cookieSignature.sign(req.sessionID, this.env.SESSION_SECRET!);
          res.json({
            success: true,
            user,
            sessionToken: signedSessionID
          });
        });
      } catch (error) {
        this.logger.error(`Login error: ${error}`, {
          prefix: LogPrefix.DEV
        });
        res.status(500).json({ error: "Login failed" });
      }
    });

    this.app.get("/v1/dev/generate-games", async (req, res) => {
      try {
        // Ensure the user is authenticated
        if (!req.session.userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        // Parse count from query parameter, default to 50
        const count = parseInt(req.query.count as string) || 50;
        const packageId = ValueUtils.validateId(parseInt(req.body.packageId));

        this.logger.audit(`Dev generate games triggered`, {
          prefix: LogPrefix.DEV,
          count,
          packageId
        });
        if (count < 1 || count > 250) {
          return res.status(400).json({ error: "Count must be between 1 and 250" });
        }

        const games: GameListItemDTO[] = [];
        for (let i = 0; i < count; i++) {
          const gameData = this.generateRandomGameData(packageId);
          const createdByUser = await this.userService.getUserBySession(req.session.userId, {
            select: ["id", "username"],
            relations: []
          });

          const game = await this.gameService.create(createdByUser, gameData);
          games.push(game);
        }

        res.json({ success: true, games });
      } catch (err: any) {
        await ErrorController.resolveError(err, this.logger, undefined, {
          source: "dev",
          operation: "generate-games"
        });
        res.status(500).json({ error: `Failed to generate games` });
      }
    });

    this.app.post("/v1/dev/upload-test-s3-files", async (req, res) => {
      try {
        const count = parseInt(req.query.count as string) || 5;

        this.logger.audit(`Dev upload test S3 files triggered`, {
          prefix: LogPrefix.DEV,
          count
        });

        if (count < 1 || count > 20) {
          return res.status(400).json({ error: "Count must be between 1 and 20" });
        }

        const uploadedFiles = await this.storage.uploadRandomTestFiles(count);

        res.json({
          success: true,
          message: `Successfully uploaded ${uploadedFiles.length} test files to S3`,
          count: uploadedFiles.length,
          files: uploadedFiles
        });
      } catch (err: any) {
        const error = await ErrorController.resolveError(err, this.logger, undefined, {
          source: "dev",
          operation: "upload-test-s3-files"
        });
        res.status(500).json({ error: `Failed to upload test S3 files: ${error.message}` });
      }
    });
  }

  /**
   * Generates random game data conforming to the createGameScheme constraints.
   * @returns {GameCreateDTO} Random game data object
   */
  private generateRandomGameData(packageId: number): GameCreateDTO {
    // Random title length between min and max
    const titleLength =
      Math.floor(Math.random() * (GAME_TITLE_MAX_CHARS - GAME_TITLE_MIN_CHARS + 1)) +
      GAME_TITLE_MIN_CHARS;
    const title = this.generateRandomString(titleLength);

    const isPrivate = Math.random() < 0.5;

    const ageRestrictions = Object.values(AgeRestriction);
    const ageRestriction = ageRestrictions[Math.floor(Math.random() * ageRestrictions.length)];

    const maxPlayers = Math.floor(Math.random() * GAME_MAX_PLAYERS) + 1;

    return {
      title,
      packageId,
      isPrivate,
      ageRestriction,
      maxPlayers
    };
  }

  private generateRandomString(length: number): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}
