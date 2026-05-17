import { type Express, type Request, type Response, Router } from "express";
import Joi from "joi";
import https, { type RequestOptions } from "node:https";
import { type Namespace } from "socket.io";

import { FileService } from "application/services/file/FileService";
import { TranslateService as ts } from "domain/utils/TranslateService";
import { UserService } from "application/services/user/UserService";
import { getDiscordCDNLink } from "domain/constants/discord";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { type DiscordProfile } from "domain/types/discord/DiscordProfile";
import { type DiscordProfileDTO } from "domain/types/dto/auth/DiscordProfileDTO";
import { type GuestLoginDTO } from "domain/types/dto/auth/GuestLoginDTO";
import { EOauthProvider, type Oauth2LoginDTO } from "domain/types/dto/auth/Oauth2LoginDTO";
import { type SocketAuthDTO } from "domain/types/dto/auth/SocketAuthDTO";
import { type UserDTO } from "domain/types/dto/user/UserDTO";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type PerformanceLog } from "shared/logging/LoggerTypes";
import { RedisService } from "application/services/redis/RedisService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { S3StorageService } from "application/services/storage/S3StorageService";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { guestLoginScheme, socketAuthScheme } from "presentation/schemes/auth/authSchemes";
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
    router.post("/guest", asyncHandler(this.handleGuestLogin));
  }

  private socketAuth = async (req: Request, res: Response) => {
    const authDTO = new RequestDataValidator<SocketAuthDTO>(req.body, socketAuthScheme).validate();

    const existingData = await this.socketUserDataService.getSocketData(authDTO.socketId);

    if (existingData && existingData.id) {
      throw new ClientError(ClientResponse.SOCKET_LOGGED_IN);
    }

    const userId = req.auth!.userId; // Null safety approved by auth middleware

    // Check if user already has an active socket connection (prevent duplicate connections)
    const existingSocketId = await this.socketUserDataService.findSocketIdByUserId(userId);

    if (existingSocketId && existingSocketId !== authDTO.socketId) {
      // Force disconnect the existing socket (works across instances via Redis adapter)
      this.gameNamespace.in(existingSocketId).disconnectSockets(true);

      // Clean up Redis data for the old socket
      await this.socketUserDataService.remove(existingSocketId);
    }

    await this.socketUserDataService.set(authDTO.socketId, {
      userId: userId,
      language: ts.parseAcceptLanguage(req.headers["accept-language"])
    });

    res.status(HttpStatus.OK).send();
  };

  /**
   * Handle OAuth login
   */
  private handleOauthLogin = async (req: Request, res: Response) => {
    const log = this.logger.performance(`OAuth login`, {
      prefix: LogPrefix.AUTH
    });

    const authDTO = new RequestDataValidator<Oauth2LoginDTO>(
      req.body,
      Joi.object({
        oauthProvider: Joi.valid(...Object.values(EOauthProvider)).required(),
        tokenSchema: Joi.string().max(128).allow(null),
        token: Joi.string().max(512).required()
      })
    ).validate();

    let userData: UserDTO | null = null;

    switch (authDTO.oauthProvider) {
      case EOauthProvider.DISCORD:
        userData = await this.getDiscordUser(authDTO);

        this.saveUserSession(req, res, userData, {
          successMessage: `User logged in via ${authDTO.oauthProvider}`,
          auditData: {
            email: userData?.email,
            provider: authDTO.oauthProvider
          },
          performanceLog: log
        });
        break;
      default:
        this.logger.warn(`Unsupported OAuth provider attempted`, {
          prefix: LogPrefix.AUTH,
          provider: authDTO.oauthProvider
        });
        throw new ClientError(ClientResponse.OAUTH_PROVIDER_NOT_SUPPORTED);
    }
  };

  /**
   * Handle user logout
   */
  private logout = async (req: Request, res: Response) => {
    const log = this.logger.performance(`User logout`, {
      prefix: LogPrefix.AUTH
    });
    const sessionId = req.sessionID;
    const userId = req.session.userId;

    req.session.destroy(async (err) => {
      if (err) {
        this.logger.error(`Session destroy failed`, {
          prefix: LogPrefix.AUTH,
          userId,
          error: String(err)
        });
        log.finish();
        throw new ServerError(ServerResponse.UNABLE_TO_DESTROY_SESSION, HttpStatus.INTERNAL, {
          id: req.session.id,
          userId: req.session.userId
        });
      }

      await this.redisService.del(`session:${sessionId}`);
      res.clearCookie("connect.sid");

      log.finish();

      this.logger.audit(`User logged out`, {
        prefix: LogPrefix.AUTH,
        userId
      });

      res.status(HttpStatus.OK).json({
        message: await ts.localize(ClientResponse.LOGOUT_SUCCESS, req.headers["accept-language"])
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
            : authData.token
        }
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
        avatar: Joi.string().allow(null)
      })
    ).validate();

    let user = await this.userService.findActiveByDiscordId(profile.id, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    if (!user) {
      let avatar = null;
      if (profile.avatar) {
        const avatarFileName = await this.storage.putFileFromDiscord(
          getDiscordCDNLink(profile.id, profile.avatar),
          profile.avatar
        );

        if (avatarFileName) {
          avatar = await this.fileService.writeFile(
            getDiscordCDNLink(profile.id, profile.avatar),
            avatarFileName,
            FileSource.DISCORD
          );
        }
      }

      user = await this.userService.create({
        username: profile.username,
        email: profile.email ?? null,
        discord_id: profile.id,
        birthday: null,
        avatar
      });
    }

    return this.userService.toDTO(user);
  }

  private handleGuestLogin = async (req: Request, res: Response) => {
    const clientIp = req.ip;
    const log = this.logger.performance(`Guest login`, {
      prefix: LogPrefix.AUTH
    });

    this.logger.trace("Guest login attempt started", {
      prefix: LogPrefix.AUTH,
      clientIp,
      userAgent: req.get("User-Agent")
    });

    const guestData = new RequestDataValidator<GuestLoginDTO>(
      req.body,
      guestLoginScheme
    ).validate();

    const createdUser = await this.userService.create({
      username: guestData.username, // This will be replaced with auto-generated username
      name: guestData.username, // Store as display name
      email: null,
      discord_id: null,
      birthday: null,
      avatar: null,
      is_guest: true
    });
    const userData = this.userService.toDTO(createdUser);

    this.saveUserSession(req, res, userData, {
      successMessage: "Guest user logged in",
      auditData: {
        username: userData?.username
      },
      performanceLog: log
    });
  };

  /**
   * Unified session saving method with error handling and audit logging
   */
  private saveUserSession(
    req: Request,
    res: Response,
    userData: UserDTO,
    options: {
      successMessage: string;
      auditData: Record<string, any>;
      performanceLog?: PerformanceLog;
    }
  ): void {
    const clientIp = req.ip || req.socket.remoteAddress;

    req.session.userId = userData.id;
    req.session.isGuest = userData.isGuest;

    req.session.save((err) => {
      if (err) {
        this.logger.error(`Session save error: ${err}`, {
          prefix: LogPrefix.AUTH,
          userId: userData?.id,
          clientIp
        });
        options.performanceLog?.finish();
        throw new ClientError(ClientResponse.SESSION_SAVING_ERROR);
      }

      options.performanceLog?.finish();

      this.logger.audit(options.successMessage, {
        prefix: LogPrefix.AUTH,
        userId: userData?.id,
        ...options.auditData,
        clientIp,
        userAgent: req.get("User-Agent"),
        loginTime: new Date()
      });

      res.status(HttpStatus.OK).json(userData);
    });
  }
}
