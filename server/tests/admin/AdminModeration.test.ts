import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { In, type Repository } from "typeorm";

import { MODERATOR_DEFAULT_PERMISSIONS } from "domain/constants/staffRoles";
import { SYSTEM_SOCKET_ID } from "domain/constants/game";
import { gameKey, packageKey, timerKey } from "domain/constants/redisKeys";
import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { RedisService } from "application/services/redis/RedisService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { DI_TOKENS } from "shared/di/tokens";
import { GameEvent, type GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { GameActionType } from "domain/enums/GameActionType";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  type GameClosedBroadcastData,
  type PlayerKickBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import {
  finishTestCleanup,
  NO_TEST_FAILURE,
  releaseHeldGameLock
} from "tests/socket/game/utils/QueueTestHelpers";

describe("Admin panel moderation", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let http: HttpTestClient;
  let userRepo: Repository<User>;
  let permRepo: Repository<Permission>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    utils = suite.utils;
    userRepo = suite.userRepo;
    permRepo = suite.dataSource.getRepository(Permission);
    http = createHttpTestClient(suite.serverUrl);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  // Users survive suite.reset(), so every account gets a fresh name
  let accounts = 0;
  const signIn = (name: string) =>
    utils.createAndLoginUser(userRepo, app, `${name}_${Date.now()}_${++accounts}`);

  /** Test state resets truncate the permission table; recreate what a case needs. */
  async function ensurePermissions(names: readonly string[]): Promise<Permission[]> {
    const existing = await permRepo.find({ where: { name: In([...names]) } });
    const missing = names.filter((name) => !existing.some((p) => p.name === name));
    const created = await permRepo.save(missing.map((name) => permRepo.create({ name })));
    return [...existing, ...created];
  }

  /**
   * A signed-in account holding exactly these permissions. Permissions are
   * saved before sign-in because the user cache keeps what login loaded.
   */
  async function staff(
    username: string,
    permissions: readonly string[]
  ): Promise<{ user: User; cookie: string }> {
    const name = `${username}_${Date.now()}_${++accounts}`;
    const user = await userRepo.save(
      userRepo.create({
        username: name,
        email: `${name}@test.com`,
        is_deleted: false,
        permissions: await ensurePermissions(permissions)
      })
    );
    expect(user.permissions.map((p) => p.name).sort()).toEqual([...permissions].sort());
    const { cookie } = await utils.loginExistingUser(app, user.id);
    return { user, cookie: cookie[0] };
  }

  const moderator = (name = "moderator") => staff(name, MODERATOR_DEFAULT_PERMISSIONS);
  const admin = (name = "admin") => staff(name, Object.values(Permissions));

  describe("live games", () => {
    it("lists every game and shows who is in it", () =>
      suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const mod = await moderator();

        const list = await http
          .get("/v1/admin/api/games?limit=20&offset=0")
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.OK);
        expect(list.body.data.map((g: { id: string }) => g.id)).toContain(setup.gameId);

        const gameFetch = jest.spyOn(GameRepository.prototype, "getGameEntity");
        try {
          const details = await http
            .get(`/v1/admin/api/games/${setup.gameId}`)
            .set("Cookie", mod.cookie)
            .expect(HttpStatus.OK);
          expect(gameFetch).toHaveBeenCalledTimes(1);
          expect(details.body.game).toEqual(
            list.body.data.find((g: { id: string }) => g.id === setup.gameId)
          );
          expect(details.body.isPaused).toBe(false);
          const ids = details.body.players.map((p: { id: number }) => p.id);
          expect(ids).toEqual(
            expect.arrayContaining([setup.showmanUser.id, ...setup.playerUsers.map((u) => u.id)])
          );
          expect(details.body.players).toHaveLength(4);
        } finally {
          gameFetch.mockRestore();
        }
      }));

    it("kicks a player from a running game", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        await utils.startGame(setup.showmanSocket);
        const mod = await moderator();
        const target = setup.playerUsers[1].id;

        const kicked = scenario.waitForEventMatching<PlayerKickBroadcastData>(
          setup.showmanSocket,
          SocketIOGameEvents.PLAYER_KICKED,
          (data) => data.playerId === target
        );
        const kickedSelf = scenario.waitForEventMatching<PlayerKickBroadcastData>(
          setup.playerSockets[1],
          SocketIOGameEvents.PLAYER_KICKED,
          (data) => data.playerId === target
        );

        await http
          .post(`/v1/admin/api/games/${setup.gameId}/players/${target}/kick`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NO_CONTENT);

        await Promise.all([kicked, kickedSelf]);

        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game.getPlayer(target, { fetchDisconnected: false })).toBeNull();
      }));

    it("can kick the showman", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const mod = await moderator();
        const showmanId = setup.showmanUser.id;

        const kicked = scenario.waitForEventMatching<PlayerKickBroadcastData>(
          setup.playerSockets[0],
          SocketIOGameEvents.PLAYER_KICKED,
          (data) => data.playerId === showmanId
        );

        await http
          .post(`/v1/admin/api/games/${setup.gameId}/players/${showmanId}/kick`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NO_CONTENT);
        await kicked;
      }));

    it("answers 404 when the player is not in the game", () =>
      suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const mod = await moderator();

        await http
          .post(`/v1/admin/api/games/${setup.gameId}/players/987654/kick`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NOT_FOUND);
      }));

    it("pauses and resumes a running game", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        await utils.startGame(setup.showmanSocket);
        const mod = await moderator();

        const paused = scenario.waitForEvent(setup.playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        await http
          .post(`/v1/admin/api/games/${setup.gameId}/pause`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NO_CONTENT);
        await paused;
        expect((await utils.getGameFromGameService(setup.gameId)).gameState.isPaused).toBe(true);

        const resumed = scenario.waitForEvent(
          setup.playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        await http
          .post(`/v1/admin/api/games/${setup.gameId}/unpause`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NO_CONTENT);
        await resumed;
        expect((await utils.getGameFromGameService(setup.gameId)).gameState.isPaused).toBe(false);
      }));

    it("closes a running game for everyone in it", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        await utils.startGame(setup.showmanSocket);
        const mod = await moderator();

        const everyone = [setup.showmanSocket, ...setup.playerSockets, ...setup.spectatorSockets];
        const closed = Promise.all(
          everyone.map((socket) =>
            scenario.waitForEvent<GameClosedBroadcastData>(socket, SocketIOGameEvents.GAME_CLOSED)
          )
        );

        await http
          .delete(`/v1/admin/api/games/${setup.gameId}`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NO_CONTENT);

        for (const data of await closed) {
          expect(data).toEqual({ gameId: setup.gameId, reason: "moderator" });
        }

        await http
          .get(`/v1/admin/api/games/${setup.gameId}`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NOT_FOUND);
        const list = await http
          .get("/v1/admin/api/games?limit=20&offset=0")
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.OK);
        expect(list.body.data.map((g: { id: string }) => g.id)).not.toContain(setup.gameId);
      }));

    it("refuses game moderation without manage_games", () =>
      suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const viewer = await staff("viewer", [
          Permissions.ADMIN_PANEL_ACCESS,
          Permissions.VIEW_USERS_INFO
        ]);

        await http
          .get("/v1/admin/api/games?limit=20&offset=0")
          .set("Cookie", viewer.cookie)
          .expect(HttpStatus.FORBIDDEN);
        await http
          .delete(`/v1/admin/api/games/${setup.gameId}`)
          .set("Cookie", viewer.cookie)
          .expect(HttpStatus.FORBIDDEN);

        expect((await utils.getGameFromGameService(setup.gameId)).id).toBe(setup.gameId);
      }));

    it("answers 404 when closing a missing game", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        await http
          .delete("/v1/admin/api/games/MISS")
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NOT_FOUND);
      }));

    it("keeps close cleanup queued until the game lock is available", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        await utils.startGame(setup.showmanSocket);
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        const mod = await moderator();
        const lockService = container.resolve(GameActionLockService);
        const redis = container.resolve(RedisService);
        const sessions = container.resolve(SocketUserDataService);
        const gateway = container.resolve<RealtimeGateway>(DI_TOKENS.RealtimeGateway);
        const everyone = [setup.showmanSocket, ...setup.playerSockets, ...setup.spectatorSockets];
        const actors = everyone.map((socket) => scenario.actor(socket));
        const savedTimerKey = timerKey(setup.gameId, "saved-close-regression");
        await redis.set(savedTimerKey, "saved timer", 60_000);
        const lock = await lockService.acquireLock(setup.gameId);
        expect(lock.acquired).toBe(true);
        let lockToken = lock.token;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          const mark = scenario.mark();
          const closeProbe = scenario.createAcceptedActionProbe({
            gameId: setup.gameId,
            actionType: GameActionType.ADMIN_GAME_CLOSE,
            socketId: SYSTEM_SOCKET_ID
          });
          const acceptedClose = closeProbe.waitForCount(1);
          await http
            .delete(`/v1/admin/api/games/${setup.gameId}`)
            .set("Cookie", mod.cookie)
            .expect(HttpStatus.NO_CONTENT);
          await acceptedClose;
          await scenario.assert.noInboundMany({
            actors,
            event: SocketIOGameEvents.GAME_CLOSED,
            afterSequence: mark,
            durationMs: 100
          });
          await scenario.assert.noInboundMany({
            actors,
            event: SocketIOEvents.GAMES,
            afterSequence: mark,
            durationMs: 100
          });
          expect(await redis.get(savedTimerKey)).toBe("saved timer");
          expect(await redis.scan(gameKey(setup.gameId))).toEqual([gameKey(setup.gameId)]);
          expect(await redis.scan(packageKey(setup.gameId))).toEqual([packageKey(setup.gameId)]);
          expect((await gateway.getRoomSocketIds(setup.gameId)).sort()).toEqual(
            everyone.map((s) => s.id).sort()
          );
          for (const socket of everyone) {
            expect((await sessions.getSocketData(socket.id!))?.gameId).toBe(setup.gameId);
          }

          const closed = Promise.all(
            everyone.map((socket) =>
              scenario.waitForEvent<GameClosedBroadcastData>(socket, SocketIOGameEvents.GAME_CLOSED)
            )
          );
          const lobbyDeleted = scenario.waitForEventMatching<GameEventDTO>(
            setup.showmanSocket,
            SocketIOEvents.GAMES,
            (data) => data.event === GameEvent.DELETED && data.data.id === setup.gameId
          );
          const triggerProbe = scenario.createAcceptedActionProbe({
            gameId: setup.gameId,
            actionType: GameActionType.PAUSE,
            socketId: setup.showmanSocket.id
          });
          const acceptedTrigger = triggerProbe.waitForCount(1);
          lockToken = await releaseHeldGameLock(lockService, setup.gameId, lockToken);
          scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});
          const [notifications] = await Promise.all([closed, lobbyDeleted, acceptedTrigger]);
          expect(notifications).toEqual(
            everyone.map(() => ({ gameId: setup.gameId, reason: "moderator" }))
          );
          await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
          expect(closeProbe.records()).toHaveLength(1);
          expect(triggerProbe.records()).toHaveLength(1);
          expect(await redis.scan(gameKey(setup.gameId))).toEqual([]);
          expect(await redis.scan(packageKey(setup.gameId))).toEqual([]);
          expect(await redis.get(savedTimerKey)).toBeNull();
          expect(await gateway.getRoomSocketIds(setup.gameId)).toEqual([]);
          for (const socket of everyone) {
            expect((await sessions.getSocketData(socket.id!))?.gameId).toBeNull();
            scenario.assert.expectDirectedEventCount({
              actor: scenario.actor(socket),
              direction: "inbound",
              event: SocketIOGameEvents.GAME_CLOSED,
              afterSequence: mark,
              expectedCount: 1
            });
          }
          scenario.assert.expectDirectedEventCount({
            actor: scenario.actor(setup.showmanSocket),
            direction: "inbound",
            event: SocketIOEvents.GAMES,
            afterSequence: mark,
            expectedCount: 1
          });
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [], async () => {
            lockToken = await releaseHeldGameLock(lockService, setup.gameId, lockToken);
          });
        }
      }));

    it("keeps moderator privileges out of player socket payloads", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        await utils.startGame(setup.showmanSocket);
        const mod = await moderator();
        const actor = scenario.actor(setup.playerSockets[0]);
        const recipients = [setup.showmanSocket, ...setup.playerSockets].map((socket) =>
          scenario.actor(socket)
        );

        const commands = [
          {
            type: GameActionType.PAUSE,
            event: SocketIOGameEvents.GAME_PAUSE,
            broadcast: SocketIOGameEvents.GAME_PAUSE,
            error: "Only showman can pause the game"
          },
          {
            type: GameActionType.UNPAUSE,
            event: SocketIOGameEvents.GAME_UNPAUSE,
            broadcast: SocketIOGameEvents.GAME_UNPAUSE,
            error: "Only showman can unpause the game"
          },
          {
            type: GameActionType.PLAYER_KICK,
            event: SocketIOGameEvents.PLAYER_KICKED,
            broadcast: SocketIOGameEvents.PLAYER_KICKED,
            error: "Only showman can manage players"
          }
        ];

        for (const command of commands) {
          if (command.type === GameActionType.UNPAUSE) {
            const paused = scenario.waitForEvent(
              setup.playerSockets[0],
              SocketIOGameEvents.GAME_PAUSE
            );
            await http
              .post(`/v1/admin/api/games/${setup.gameId}/pause`)
              .set("Cookie", mod.cookie)
              .expect(HttpStatus.NO_CONTENT);
            await paused;
          }
          await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
          const before = await utils.getGameFromGameService(setup.gameId);
          const stateBefore = structuredClone(before.gameState);
          const playersBefore = before.players.map((player) => player.toDTO());
          const mark = scenario.mark();
          const probe = scenario.createAcceptedActionProbe({
            gameId: setup.gameId,
            actionType: command.type,
            socketId: actor.socketId
          });
          const accepted = probe.waitForCount(1);
          const rejected = scenario.waitForEvent<{ message: string }>(
            setup.playerSockets[0],
            SocketIOEvents.ERROR
          );
          actor.emit(
            command.event,
            command.type === GameActionType.PLAYER_KICK
              ? { playerId: setup.playerUsers[1].id }
              : { moderator: true, socketId: "SYSTEM", adminUserId: mod.user.id }
          );
          const [error] = await Promise.all([rejected, accepted]);
          expect(error.message).toBe(command.error);
          await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
          expect(probe.records()).toHaveLength(1);
          await scenario.assert.noInboundMany({
            actors: recipients,
            event: command.broadcast,
            afterSequence: mark,
            durationMs: 100
          });
          const after = await utils.getGameFromGameService(setup.gameId);
          expect(after.gameState).toEqual(stateBefore);
          expect(after.players.map((player) => player.toDTO())).toEqual(playersBefore);
        }
      }));
  });

  describe("staff roles", () => {
    it("lists the permissions and the role presets", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const res = await http
          .get("/v1/admin/api/roles")
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.OK);

        expect(res.body.permissions).toEqual(Object.values(Permissions));
        const presets = Object.fromEntries(
          res.body.roles.map((r: { id: string; permissions: string[] }) => [r.id, r.permissions])
        );
        expect(presets.moderator).toEqual([...MODERATOR_DEFAULT_PERMISSIONS]);
        expect(presets.admin).toEqual(Object.values(Permissions));
        expect(presets.user).toEqual([]);
      }));

    it("lets an admin make someone a moderator and tune their permissions", () =>
      suite.scenario(async () => {
        const boss = await admin();
        const { user: target } = await signIn("newmod");

        const res = await http
          .put(`/v1/admin/api/users/${target.id}/permissions`)
          .set("Cookie", boss.cookie)
          .send({ permissions: [...MODERATOR_DEFAULT_PERMISSIONS] })
          .expect(HttpStatus.OK);
        expect(res.body.permissions.map((p: { name: string }) => p.name).sort()).toEqual(
          [...MODERATOR_DEFAULT_PERMISSIONS].sort()
        );

        // Take one permission away again
        const tuned = MODERATOR_DEFAULT_PERMISSIONS.filter((p) => p !== Permissions.BAN_USERS);
        await http
          .put(`/v1/admin/api/users/${target.id}/permissions`)
          .set("Cookie", boss.cookie)
          .send({ permissions: tuned })
          .expect(HttpStatus.OK);

        const saved = await userRepo.findOne({
          where: { id: target.id },
          relations: ["permissions"]
        });
        expect(saved!.permissions.map((p) => p.name).sort()).toEqual([...tuned].sort());
      }));

    it("rejects unknown permission names", () =>
      suite.scenario(async () => {
        const boss = await admin();
        const { user: target } = await signIn("someone");

        await http
          .put(`/v1/admin/api/users/${target.id}/permissions`)
          .set("Cookie", boss.cookie)
          .send({ permissions: ["rule_the_world"] })
          .expect(HttpStatus.BAD_REQUEST);
      }));

    it("keeps moderators out of permission changes", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const { user: target } = await signIn("someone");

        await http
          .put(`/v1/admin/api/users/${target.id}/permissions`)
          .set("Cookie", mod.cookie)
          .send({ permissions: [Permissions.MANAGE_PERMISSIONS] })
          .expect(HttpStatus.FORBIDDEN);
      }));

    it("stops an admin from changing their own permissions", () =>
      suite.scenario(async () => {
        const boss = await admin();

        const res = await http
          .put(`/v1/admin/api/users/${boss.user.id}/permissions`)
          .set("Cookie", boss.cookie)
          .send({ permissions: [] })
          .expect(HttpStatus.FORBIDDEN);
        expect(res.body.error).toContain("your own account");
      }));
  });

  describe("user moderation", () => {
    it("lets a moderator ban and unban a regular user", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const { user: target } = await signIn("rowdy");
        const batchFetch = jest.spyOn(UserRepository.prototype, "findByIds");
        try {
          await http
            .post(`/v1/admin/api/users/${target.id}/ban`)
            .set("Cookie", mod.cookie)
            .expect(HttpStatus.OK);
          expect(batchFetch).toHaveBeenCalledTimes(1);
          expect(batchFetch.mock.calls[0][0]).toEqual([mod.user.id, target.id]);
          expect((await userRepo.findOneBy({ id: target.id }))!.is_banned).toBe(true);

          batchFetch.mockClear();
          await http
            .post(`/v1/admin/api/users/${target.id}/unban`)
            .set("Cookie", mod.cookie)
            .expect(HttpStatus.OK);
          expect(batchFetch).toHaveBeenCalledTimes(1);
          expect(batchFetch.mock.calls[0][0]).toEqual([mod.user.id, target.id]);
          expect((await userRepo.findOneBy({ id: target.id }))!.is_banned).toBe(false);
        } finally {
          batchFetch.mockRestore();
        }
      }));

    it("answers 404 when moderating a missing user", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        await http
          .post("/v1/admin/api/users/987654/ban")
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.NOT_FOUND);
      }));

    it("stops a moderator from banning or muting other staff", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const otherMod = await moderator("othermod");
        const boss = await admin();

        for (const target of [otherMod.user.id, boss.user.id]) {
          const res = await http
            .post(`/v1/admin/api/users/${target}/ban`)
            .set("Cookie", mod.cookie)
            .expect(HttpStatus.FORBIDDEN);
          expect(res.body.error).toContain("Only an admin");

          await http
            .post(`/v1/admin/api/users/${target}/mute`)
            .set("Cookie", mod.cookie)
            .send({ mutedUntil: new Date(Date.now() + 3_600_000).toISOString() })
            .expect(HttpStatus.FORBIDDEN);
        }
        expect((await userRepo.findOneBy({ id: boss.user.id }))!.is_banned).toBe(false);
      }));

    it("lets an admin ban a moderator but not themselves", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const boss = await admin();

        await http
          .post(`/v1/admin/api/users/${mod.user.id}/ban`)
          .set("Cookie", boss.cookie)
          .expect(HttpStatus.OK);
        await http
          .post(`/v1/admin/api/users/${boss.user.id}/ban`)
          .set("Cookie", boss.cookie)
          .expect(HttpStatus.FORBIDDEN);
      }));

    it("keeps account deletion an admin permission by default", () =>
      suite.scenario(async () => {
        const mod = await moderator();
        const { user: target } = await signIn("someone");

        await http
          .delete(`/v1/admin/api/users/${target.id}`)
          .set("Cookie", mod.cookie)
          .expect(HttpStatus.FORBIDDEN);
      }));
  });
});
