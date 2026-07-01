import { describe, expect, it, jest } from "@jest/globals";

import { configureActionHandlers } from "application/config/ActionHandlerConfig";
import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameIdStrategy, SOCKET_ACTION_MAP } from "presentation/controllers/io/SocketActionMap";
import { type ILogger } from "shared/logging/ILogger";

const logger = {
  info: jest.fn(),
  warn: jest.fn()
} as unknown as ILogger;

const buildActionHandlerDeps = (
  registry: GameActionHandlerRegistry
): Parameters<typeof configureActionHandlers>[0] =>
  ({
    registry,
    socketGameValidationService: {},
    socketIOChatService: {},
    socketGameTimerService: {},
    secretQuestionService: {},
    stakeQuestionService: {},
    playerGameStatsService: {},
    gameStatisticsCollectorService: {},
    userService: {},
    socketChatRepository: {},
    gameProgressionCoordinator: {},
    gameService: {},
    timerExpirationService: {},
    phaseTransitionRouter: {},
    playerLeaveService: {},
    transitionResourceService: {},
    packageStore: {},
    logger
  }) as Parameters<typeof configureActionHandlers>[0];

describe("socket action contracts", () => {
  it("routes MEDIA_DOWNLOADED through the queued game action path", () => {
    const entry = SOCKET_ACTION_MAP.find(
      (actionEntry) => actionEntry.event === SocketIOGameEvents.MEDIA_DOWNLOADED
    );

    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      event: SocketIOGameEvents.MEDIA_DOWNLOADED,
      actionType: GameActionType.MEDIA_DOWNLOADED,
      gameIdStrategy: GameIdStrategy.FROM_SESSION
    });
    expect(entry?.directExecution).not.toBe(true);
    expect(entry?.allowNullGameId).not.toBe(true);
  });

  it("registers a handler for MEDIA_DOWNLOADED actions", () => {
    const registry = new GameActionHandlerRegistry(logger);

    configureActionHandlers(buildActionHandlerDeps(registry));

    expect(registry.has(GameActionType.MEDIA_DOWNLOADED)).toBe(true);
  });
});
