import Redis from "ioredis";
import { Server as IOServer } from "socket.io";

import { Container, CONTAINER_TYPES } from "application/Container";
import { StorageContextBuilder } from "application/context/storage/StorageContextBuilder";
import { GameExpirationHandler } from "application/handlers/GameExpirationHandler";
import { TimerExpirationHandler } from "application/handlers/TimerExpirationHandler";
import { FileService } from "application/services/file/FileService";
import { FileUsageService } from "application/services/file/FileUsageService";
import { GameService } from "application/services/game/GameService";
import { PackageService } from "application/services/package/PackageService";
import { PackageTagService } from "application/services/package/PackageTagService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { TranslateService } from "application/services/text/TranslateService";
import { UserService } from "application/services/user/UserService";
import { UserCacheUseCase } from "application/usecases/user/UserCacheUseCase";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { RedisCache } from "infrastructure/cache/RedisCache";
import { Environment } from "infrastructure/config/Environment";
import { Database } from "infrastructure/database/Database";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import { File } from "infrastructure/database/models/File";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { FileRepository } from "infrastructure/database/repositories/FileRepository";
import { FileUsageRepository } from "infrastructure/database/repositories/FileUsageRepository";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { PackageTagRepository } from "infrastructure/database/repositories/PackageTagRepository";
import { PermissionRepository } from "infrastructure/database/repositories/PermissionRepository";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { SocketUserDataRepository } from "infrastructure/database/repositories/socket/SocketUserDataRepository";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { DependencyService } from "infrastructure/services/dependency/DependencyService";
import { RedisPubSubService } from "infrastructure/services/redis/RedisPubSubService";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

export class DIConfig {
  constructor(
    private readonly db: Database,
    private readonly redisClient: Redis,
    private readonly io: IOServer,
    private readonly env: Environment,
    private readonly logger: ILogger
  ) {
    //
  }

  public async initialize() {
    Container.register(CONTAINER_TYPES.Database, this.db, "infrastructure");
    Container.register(
      CONTAINER_TYPES.Redis,
      this.redisClient,
      "infrastructure"
    );
    Container.register(CONTAINER_TYPES.IO, this.io, "infrastructure");

    const db = Container.get<Database>(CONTAINER_TYPES.Database);

    Container.register(
      CONTAINER_TYPES.FileUsageRepository,
      new FileUsageRepository(db.getRepository(FileUsage)),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.FileUsageService,
      new FileUsageService(
        Container.get<FileUsageRepository>(CONTAINER_TYPES.FileUsageRepository)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.PackageTagRepository,
      new PackageTagRepository(db.getRepository(PackageTag)),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.PackageTagService,
      new PackageTagService(
        Container.get<PackageTagRepository>(
          CONTAINER_TYPES.PackageTagRepository
        )
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.FileRepository,
      new FileRepository(db.getRepository(File)),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.FileService,
      new FileService(
        Container.get<FileRepository>(CONTAINER_TYPES.FileRepository)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.DependencyService,
      new DependencyService(
        Container.get<FileService>(CONTAINER_TYPES.FileService),
        Container.get<FileUsageService>(CONTAINER_TYPES.FileUsageService)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.PermissionRepository,
      new PermissionRepository(db.getRepository(Permission)),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.TranslateService,
      new TranslateService(),
      "service"
    );

    // Initialize TranslateService to preload translations
    TranslateService.setLogger(this.logger);
    await TranslateService.initialize();

    Container.register(
      CONTAINER_TYPES.RedisRepository,
      new RedisRepository(this.logger),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.RedisService,
      new RedisService(
        Container.get<RedisRepository>(CONTAINER_TYPES.RedisRepository)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.RedisCache,
      new RedisCache(Container.get<RedisService>(CONTAINER_TYPES.RedisService)),
      "infrastructure"
    );

    Container.register(
      CONTAINER_TYPES.UserCacheUseCase,
      new UserCacheUseCase(
        Container.get<RedisCache>(CONTAINER_TYPES.RedisCache)
      ),
      "useCase"
    );

    Container.register(
      CONTAINER_TYPES.PackageRepository,
      new PackageRepository(
        db,
        db.getRepository(Package),
        Container.get<PackageTagService>(CONTAINER_TYPES.PackageTagService),
        Container.get<FileService>(CONTAINER_TYPES.FileService)
      ),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.UserRepository,
      new UserRepository(
        db.getRepository(User),
        Container.get<FileUsageService>(CONTAINER_TYPES.FileUsageService),
        Container.get<UserCacheUseCase>(CONTAINER_TYPES.UserCacheUseCase),
        this.logger
      ),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.UserNotificationRoomService,
      new UserNotificationRoomService(
        Container.get<IOServer>(CONTAINER_TYPES.IO).of(SOCKET_GAME_NAMESPACE),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.UserService,
      new UserService(
        Container.get<UserRepository>(CONTAINER_TYPES.UserRepository),
        Container.get<FileUsageService>(CONTAINER_TYPES.FileUsageService),
        Container.get<UserNotificationRoomService>(
          CONTAINER_TYPES.UserNotificationRoomService
        ),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.S3StorageService,
      new S3StorageService(
        StorageContextBuilder.buildS3Context(this.env),
        Container.get<FileService>(CONTAINER_TYPES.FileService),
        Container.get<FileUsageService>(CONTAINER_TYPES.FileUsageService),
        Container.get<UserService>(CONTAINER_TYPES.UserService),
        Container.get<DependencyService>(CONTAINER_TYPES.DependencyService),
        this.logger
      ),
      "service"
    );

    const gameIndexManager = new GameIndexManager(
      Container.get<RedisService>(CONTAINER_TYPES.RedisService),
      this.logger
    );

    Container.register(
      CONTAINER_TYPES.PackageService,
      new PackageService(
        Container.get<PackageRepository>(CONTAINER_TYPES.PackageRepository),
        Container.get<UserService>(CONTAINER_TYPES.UserService),
        Container.get<S3StorageService>(CONTAINER_TYPES.S3StorageService)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.GameRepository,
      new GameRepository(
        Container.get<RedisService>(CONTAINER_TYPES.RedisService),
        gameIndexManager,
        Container.get<UserService>(CONTAINER_TYPES.UserService),
        Container.get<PackageService>(CONTAINER_TYPES.PackageService),
        Container.get<S3StorageService>(CONTAINER_TYPES.S3StorageService),
        this.logger
      ),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.GameService,
      new GameService(
        Container.get<IOServer>(CONTAINER_TYPES.IO),
        Container.get<GameRepository>(CONTAINER_TYPES.GameRepository),
        Container.get<UserService>(CONTAINER_TYPES.UserService),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketUserDataRepository,
      new SocketUserDataRepository(
        Container.get<RedisService>(CONTAINER_TYPES.RedisService)
      ),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.SocketUserDataService,
      new SocketUserDataService(
        Container.get<SocketUserDataRepository>(
          CONTAINER_TYPES.SocketUserDataRepository
        )
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketGameContextService,
      new SocketGameContextService(
        Container.get<SocketUserDataService>(
          CONTAINER_TYPES.SocketUserDataService
        ),
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketGameTimerService,
      new SocketGameTimerService(
        Container.get<GameService>(CONTAINER_TYPES.GameService)
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketGameValidationService,
      new SocketGameValidationService(),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketQuestionStateService,
      new SocketQuestionStateService(
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.RoundHandlerFactory,
      new RoundHandlerFactory(),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketIOQuestionService,
      new SocketIOQuestionService(
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        Container.get<SocketGameContextService>(
          CONTAINER_TYPES.SocketGameContextService
        ),
        Container.get<SocketGameValidationService>(
          CONTAINER_TYPES.SocketGameValidationService
        ),
        Container.get<SocketQuestionStateService>(
          CONTAINER_TYPES.SocketQuestionStateService
        ),
        Container.get<SocketGameTimerService>(
          CONTAINER_TYPES.SocketGameTimerService
        ),
        Container.get<RoundHandlerFactory>(CONTAINER_TYPES.RoundHandlerFactory),
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.FinalRoundService,
      new FinalRoundService(
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        Container.get<SocketGameContextService>(
          CONTAINER_TYPES.SocketGameContextService
        ),
        Container.get<SocketGameValidationService>(
          CONTAINER_TYPES.SocketGameValidationService
        ),
        Container.get<SocketQuestionStateService>(
          CONTAINER_TYPES.SocketQuestionStateService
        ),
        Container.get<RoundHandlerFactory>(CONTAINER_TYPES.RoundHandlerFactory)
      ),
      "service"
    );

    const handlers: RedisExpirationHandler[] = [
      new GameExpirationHandler(
        gameIndexManager,
        Container.get<RedisService>(CONTAINER_TYPES.RedisService)
      ),
      new TimerExpirationHandler(
        Container.get<IOServer>(CONTAINER_TYPES.IO),
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        Container.get<SocketIOQuestionService>(
          CONTAINER_TYPES.SocketIOQuestionService
        ),
        Container.get<RedisService>(CONTAINER_TYPES.RedisService),
        Container.get<SocketQuestionStateService>(
          CONTAINER_TYPES.SocketQuestionStateService
        ),
        Container.get<RoundHandlerFactory>(CONTAINER_TYPES.RoundHandlerFactory),
        Container.get<FinalRoundService>(CONTAINER_TYPES.FinalRoundService),
        this.logger
      ),
    ];

    Container.register(
      CONTAINER_TYPES.RedisPubSubService,
      new RedisPubSubService(
        Container.get<RedisService>(CONTAINER_TYPES.RedisService),
        handlers,
        this.logger
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketIOGameService,
      new SocketIOGameService(
        Container.get<SocketUserDataService>(
          CONTAINER_TYPES.SocketUserDataService
        ),
        Container.get<GameService>(CONTAINER_TYPES.GameService),
        Container.get<UserService>(CONTAINER_TYPES.UserService),
        Container.get<SocketGameContextService>(
          CONTAINER_TYPES.SocketGameContextService
        ),
        Container.get<SocketGameTimerService>(
          CONTAINER_TYPES.SocketGameTimerService
        ),
        Container.get<SocketGameValidationService>(
          CONTAINER_TYPES.SocketGameValidationService
        ),
        Container.get<RoundHandlerFactory>(CONTAINER_TYPES.RoundHandlerFactory),
        Container.get<SocketIOQuestionService>(
          CONTAINER_TYPES.SocketIOQuestionService
        )
      ),
      "service"
    );

    Container.register(
      CONTAINER_TYPES.SocketChatRepository,
      new SocketChatRepository(
        Container.get<RedisService>(CONTAINER_TYPES.RedisService)
      ),
      "repository"
    );

    Container.register(
      CONTAINER_TYPES.SocketIOChatService,
      new SocketIOChatService(
        Container.get<SocketChatRepository>(
          CONTAINER_TYPES.SocketChatRepository
        ),
        Container.get<SocketGameContextService>(
          CONTAINER_TYPES.SocketGameContextService
        )
      ),
      "service"
    );
  }
}
