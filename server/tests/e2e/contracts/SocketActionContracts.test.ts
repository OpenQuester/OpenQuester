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

const configureRegistry = (): GameActionHandlerRegistry => {
  const registry = new GameActionHandlerRegistry(logger);
  configureActionHandlers(buildActionHandlerDeps(registry));
  return registry;
};

describe("socket action contracts", () => {
  it("has one socket action entry per socket event", () => {
    const events = SOCKET_ACTION_MAP.map((entry) => entry.event);

    expect(new Set(events).size).toBe(events.length);
  });

  it("registers handlers for every mapped socket action", () => {
    const registry = configureRegistry();

    for (const entry of SOCKET_ACTION_MAP) {
      expect(registry.has(entry.actionType)).toBe(true);
    }
  });

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
});
