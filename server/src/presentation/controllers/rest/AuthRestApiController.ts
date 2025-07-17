import { Router, type Express, type Request, type Response } from "express";
import Joi from "joi";
import https, { RequestOptions } from "node:https";
import { Namespace } from "socket.io";

import { FileService } from "application/services/file/FileService";
import { TranslateService as ts } from "application/services/text/TranslateService";
import { UserService } from "application/services/user/UserService";
import { getDiscordCDNLink } from "domain/constants/discord";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { DiscordProfile } from "domain/types/discord/DiscordProfile";
import { DiscordProfileDTO } from "domain/types/dto/auth/DiscordProfileDTO";
import {
  EOauthProvider,
  Oauth2LoginDTO,
} from "domain/types/dto/auth/Oauth2LoginDTO";
import { SocketAuthDTO } from "domain/types/dto/auth/SocketAuthDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { socketAuthScheme } from "presentation/schemes/auth/authSchemes";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

export class AuthRestApiController {
  constructor(
    private readonly gameNamespace: Namespace,
    private readonly app: Express,
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
    private readonly storage: S3StorageService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly logger: ILogger
  ) {
    const router = Router();

    this.app.use("/v1/auth", router);

    router.get("/logout", asyncHandler(this.logout));
    router.post("/socket", asyncHandler(this.socketAuth));
    router.post("/oauth2", asyncHandler(this.handleOauthLogin));
  }

  private socketAuth = async (req: Request, res: Response) => {
    const authDTO = new RequestDataValidator<SocketAuthDTO>(
      req.body,
      socketAuthScheme
    ).validate();

    const existingData = await this.socketUserDataService.getSocketData(
      authDTO.socketId
    );

    if (existingData && existingData.id) {
      throw new ClientError(ClientResponse.SOCKET_LOGGED_IN);
    }

    const socket = this.gameNamespace.sockets.get(authDTO.socketId);

    // Apply userId to socket for later use
    if (socket) {
      socket.userId = req.user!.id; // Null safety approved by auth middleware
    }

    await this.socketUserDataService.set(authDTO.socketId, {
      userId: req.user!.id,
      language: ts.parseHeaders(req.headers),
    });

    res.status(HttpStatus.OK).send();
  };

  private handleOauthLogin = async (req: Request, res: Response) => {
    const startTime = Date.now();
    const clientIp = req.ip;

    this.logger.trace("OAuth login attempt started", {
      prefix: "[AUTH]: ",
      clientIp,
      userAgent: req.get("User-Agent"),
    });

    const authDTO = new RequestDataValidator<Oauth2LoginDTO>(
      req.body,
      Joi.object({
        oauthProvider: Joi.valid(...Object.values(EOauthProvider)).required(),
        tokenSchema: Joi.string().max(128).allow(null),
        token: Joi.string().max(512).required(),
      })
    ).validate();

    let userData: UserDTO | null = null;

    switch (authDTO.oauthProvider) {
      case "discord":
        userData = await this.getDiscordUser(authDTO);

        req.session.userId = userData.id;

        req.session.save((err) => {
          if (err) {
            const operationTime = Date.now() - startTime;
            this.logger.error(`Session save error: ${err}`, {
              prefix: "[AUTH]: ",
              operationTime,
              userId: userData?.id,
              clientIp,
            });
            throw new ClientError(ClientResponse.SESSION_SAVING_ERROR);
          }

          const operationTime = Date.now() - startTime;
          this.logger.performance(
            `OAuth login completed in ${operationTime}ms`,
            {
              prefix: "[AUTH]: ",
              operationTime,
              userId: userData?.id,
              provider: authDTO.oauthProvider,
            }
          );

          this.logger.audit(`User logged in via ${authDTO.oauthProvider}`, {
            userId: userData?.id,
            email: userData?.email,
            provider: authDTO.oauthProvider,
            clientIp,
            userAgent: req.get("User-Agent"),
            loginTime: new Date(),
          });

          res.status(HttpStatus.OK).json(userData);
        });
        break;
      default:
        this.logger.warn(
          `Unsupported OAuth provider: ${authDTO.oauthProvider}`,
          {
            prefix: "[AUTH]: ",
            provider: authDTO.oauthProvider,
            clientIp,
          }
        );
        throw new ClientError(ClientResponse.OAUTH_PROVIDER_NOT_SUPPORTED);
    }
  };

  private logout = async (req: Request, res: Response) => {
    const startTime = Date.now();
    const sessionId = req.sessionID;
    const userId = req.session.userId;
    const clientIp = req.ip;

    this.logger.trace("User logout started", {
      prefix: "[AUTH]: ",
      userId,
      sessionId,
      clientIp,
    });

    req.session.destroy(async (err) => {
      if (err) {
        const operationTime = Date.now() - startTime;
        this.logger.error(`Session destroy error: ${err}`, {
          prefix: "[AUTH]: ",
          operationTime,
          userId,
          sessionId,
          clientIp,
        });
        throw new ServerError(
          ServerResponse.UNABLE_TO_DESTROY_SESSION,
          HttpStatus.INTERNAL,
          {
            id: req.session.id,
            userId: req.session.userId,
          }
        );
      }

      await this.redisService.del(`session:${sessionId}`);
      res.clearCookie("connect.sid");

      const operationTime = Date.now() - startTime;
      this.logger.performance(`User logout completed in ${operationTime}ms`, {
        prefix: "[AUTH]: ",
        operationTime,
        userId,
        sessionId,
      });

      this.logger.audit(`User logged out`, {
        userId,
        sessionId,
        clientIp,
        userAgent: req.get("User-Agent"),
        logoutTime: new Date(),
      });

      res.status(HttpStatus.OK).json({
        message: await ts.localize(ClientResponse.LOGOUT_SUCCESS, req.headers),
      });
    });
  };

  private async getDiscordUser(authData: Oauth2LoginDTO): Promise<UserDTO> {
    const discordUser = await new Promise<string>((resolve, reject) => {
      const options: RequestOptions = {
        hostname: "discord.com",
        path: "/api/users/@me",
        method: "GET",
        headers: {
          authorization: authData.tokenSchema
            ? `${authData.tokenSchema} ${authData.token}`
            : authData.token,
        },
      };

      const request = https.request(options, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          return (data += chunk);
        });
        response.on("end", () => resolve(data));
      });

      request.on("error", reject);
      request.end();
    });

    // Parse Discord response
    let profileData: DiscordProfile;
    try {
      profileData = JSON.parse(discordUser);
    } catch {
      throw new ClientError(ClientResponse.CANNOT_PARSE_USER_DATA);
    }

    const profile = new RequestDataValidator<DiscordProfileDTO>(
      profileData,
      Joi.object({
        id: Joi.string().required(),
        username: Joi.string().required(),
        email: Joi.string().email().allow(null),
        avatar: Joi.string().allow(null),
      })
    ).validate();

    let user = await this.userService.findOne(
      { discord_id: profile.id, is_deleted: false },
      {
        select: USER_SELECT_FIELDS,
        relations: USER_RELATIONS,
        relationSelects: {
          avatar: ["id", "filename"],
          permissions: ["id", "name"],
        },
      }
    );

    if (!user) {
      user = new User();
      user.discord_id = profile.id;
      user.username = profile.username;
      user.email = profile.email ?? null;
      if (profile.avatar) {
        const avatarFileName = await this.storage.putFileFromDiscord(
          getDiscordCDNLink(profile.id, profile.avatar),
          profile.avatar
        );

        if (avatarFileName) {
          const file = await this.fileService.writeFile(
            getDiscordCDNLink(profile.id, profile.avatar),
            avatarFileName,
            FileSource.DISCORD
          );

          user.avatar = file;
        }
      }

      const registerData: RegisterUser = {
        username: user.username,
        email: user.email,
        discord_id: user.discord_id,
        birthday: user.birthday,
        avatar: user.avatar,
      };

      user = await this.userService.create(registerData);
    }

    return user.toDTO();
  }
}
