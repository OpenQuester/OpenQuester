import { PackageUtils } from "tests/utils/PackageUtils";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { container } from "tsyringe";
import { GameActionType } from "domain/enums/GameActionType";
import { PlayerRole } from "domain/types/game/PlayerRole";
import type { SecretQuestionAwardedPayload } from "domain/types/socket/game/SecretQuestionTransferData";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { AddSecretRules_0_34_1_1794418572612 } from "infrastructure/database/migrations/0.34.1_AddSecretRules_1794418572612";
import { TestUtils } from "tests/utils/TestUtils";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import {
  SecretQuestionPriceBroadcastData,
  SecretQuestionTransferBroadcastData
} from "domain/types/socket/game/SecretQuestionTransferData";
import { User } from "infrastructure/database/models/User";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

const PRICES = [100, 200, 300];

/**
 * customPrice secret questions: after the transfer, the receiver picks the
 * question's price from its allowed prices (SIGame "select price").
 */
describe("Secret question price pick", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    utils.packageTransform = null;
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  /** Two players, the ANY secret question switched to customPrice and handed to player 2 */
  async function transferCustomPriceQuestion(scenario: GameScenario, prices = PRICES) {
    return transferQuestion(scenario, (secret) => {
      secret.subType = PackageQuestionSubType.CUSTOM_PRICE;
      secret.allowedPrices = prices;
    });
  }

  async function transferQuestion(
    scenario: GameScenario,
    configure: (question: PackageQuestionDTO) => void
  ) {
    utils.packageTransform = (pkg) => {
      const secret = pkg.rounds
        .flatMap(({ themes }) => themes)
        .flatMap(({ questions }) => questions)
        .find(
          (q) =>
            q.type === PackageQuestionType.SECRET &&
            q.transferType === PackageQuestionTransferType.ANY
        )!;
      secret.price = 100;
      configure(secret);
    };
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
    await utils.startGame(setup.showmanSocket);

    const secret = await utils.findQuestionByType(
      PackageQuestionType.SECRET,
      setup.gameId,
      PackageQuestionTransferType.ANY
    );
    await scenario.emitAndWaitForEvent(
      setup.showmanSocket,
      SocketIOGameEvents.SECRET_QUESTION_PICKED,
      () =>
        scenario
          .actor(setup.showmanSocket)
          .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: secret!.id })
    );

    const transfer = await scenario.emitAndWaitForEvent<SecretQuestionTransferBroadcastData>(
      setup.showmanSocket,
      SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
      () =>
        scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[1].id
        })
    );

    return { ...setup, transfer, questionId: secret!.id };
  }

  it.each([0, 1])(
    "resolves the lowest custom price in the legacy %s-player pick fallback",
    async (players) => {
      await suite.scenario(async (scenario) => {
        utils.packageTransform = (pkg) => {
          const secret = pkg.rounds
            .flatMap((r) => r.themes)
            .flatMap((t) => t.questions)
            .find(
              (q) =>
                q.type === PackageQuestionType.SECRET &&
                q.transferType === PackageQuestionTransferType.ANY
            )!;
          Object.assign(secret, {
            price: 100,
            subType: PackageQuestionSubType.CUSTOM_PRICE,
            allowedPrices: [400, 200]
          });
        };
        const setup = await utils.setupGameTestEnvironment(userRepo, app, players, 1);
        await utils.startGame(setup.showmanSocket);
        const secret = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          setup.gameId,
          PackageQuestionTransferType.ANY
        );
        const shown = scenario.waitForEvent<GameQuestionDataEventPayload>(
          setup.spectatorSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        scenario
          .actor(setup.showmanSocket)
          .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: secret!.id });
        expect((await shown).data).toMatchObject({ price: 100, realPrice: 200 });
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        expect((await utils.getGameState(setup.gameId))!.currentQuestion).toMatchObject({
          price: 100,
          realPrice: 200
        });
        const source = await container
          .resolve(PackageStore)
          .getQuestionWithTheme(setup.gameId, secret!.id);
        expect(source!.question).toMatchObject({ price: 100, realPrice: null });
      });
    }
  );

  it("resolves a custom price when every player leaves before the transfer timeout", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await transferCustomPriceQuestion(scenario, [400, 200]);
      await utils.leaveGame(setup.playerSockets[0]);
      await utils.leaveGame(setup.playerSockets[1]);
      const shown = scenario.waitForEvent<GameQuestionDataEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.QUESTION_DATA
      );
      await new TestUtils(app, userRepo, suite.serverUrl).expireTimerAndWaitForAction(
        setup.gameId,
        GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
      );
      expect((await shown).data).toMatchObject({ price: 100, realPrice: 200 });
      const source = await container
        .resolve(PackageStore)
        .getQuestionWithTheme(setup.gameId, setup.questionId);
      expect(source!.question).toMatchObject({ price: 100, realPrice: null });
    });
  });

  it("asks the receiver for a price before showing the question", async () => {
    await suite.scenario(async (scenario) => {
      const { transfer, gameId, playerUsers } = await transferCustomPriceQuestion(scenario);

      expect(transfer.toPlayerId).toBe(playerUsers[1].id);
      expect(transfer.allowedPrices).toEqual(PRICES);

      const state = await utils.getGameState(gameId);
      expect(state!.questionState).toBe(QuestionState.SECRET_TRANSFER);
      expect(state!.secretQuestionData!.priceSelection).toEqual({
        playerId: playerUsers[1].id,
        allowedPrices: PRICES
      });
    });
  });

  it("plays the question at the picked price", async () => {
    await suite.scenario(async (scenario) => {
      const { playerSockets, showmanSocket, gameId, playerUsers, questionId } =
        await transferCustomPriceQuestion(scenario);

      const questionData = scenario.waitForEvent<GameQuestionDataEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_DATA
      );
      const picked = await scenario.emitAndWaitForEvent<SecretQuestionPriceBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.SECRET_QUESTION_PRICE,
        () =>
          scenario
            .actor(playerSockets[1])
            .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 200 })
      );

      expect(picked).toMatchObject({ playerId: playerUsers[1].id, price: 200, questionId });
      const shown = (await questionData).data;
      expect(shown.realPrice).toBe(200);
      expect(shown.price).toBe(
        (await utils.getGameState(gameId))!
          .currentRound!.themes.flatMap((t) => t.questions)
          .find((q) => q.id === questionId)!.price
      );

      const state = await utils.getGameState(gameId);
      expect(state!.questionState).toBe(QuestionState.ANSWERING);
      expect(state!.answeringPlayer).toBe(playerUsers[1].id);
      expect(state!.currentQuestion).toMatchObject({ price: 100, realPrice: 200 });
      const source = await container.resolve(PackageStore).getQuestionWithTheme(gameId, questionId);
      expect(source!.question).toMatchObject({ price: 100, realPrice: null });
      const { socket } = await utils.createGameClient(app, userRepo);
      const snapshot = scenario.waitForEvent(socket, SocketIOGameEvents.GAME_DATA);
      const rejoinedQuestion = scenario.waitForEvent<GameQuestionDataEventPayload>(
        socket,
        SocketIOGameEvents.QUESTION_DATA
      );
      scenario.actor(socket).emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await snapshot).gameState.currentQuestion).toMatchObject({
        price: 100,
        realPrice: 200
      });
      expect((await rejoinedQuestion).data).toMatchObject({ price: 100, realPrice: 200 });
      expect(state!.secretQuestionData).toBeNull();
    });
  });

  it("only lets the receiver pick, and only an offered price", async () => {
    await suite.scenario(async (scenario) => {
      const { playerSockets, gameId } = await transferCustomPriceQuestion(scenario);

      await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOEvents.ERROR, () =>
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 100 })
      );
      await scenario.emitAndWaitForEvent(playerSockets[1], SocketIOEvents.ERROR, () =>
        scenario
          .actor(playerSockets[1])
          .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 250 })
      );

      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SECRET_TRANSFER);
    });
  });

  it("keeps dynamic secret prices independent in two games using one published package", async () => {
    await suite.scenario(async (scenario) => {
      const hostA = await utils.createGameClient(app, userRepo);
      const hostB = await utils.createGameClient(app, userRepo);
      const http = createHttpTestClient(suite.serverUrl);
      const fixture = new PackageUtils().createTestPackageData(
        { id: hostA.user.id, username: hostA.user.username },
        false
      );
      const secret = fixture.rounds[0].themes[0].questions.find(
        (question) => question.transferType === PackageQuestionTransferType.ANY
      )!;
      secret.price = 100;
      secret.secretRules = {
        outcome: "question",
        priceAnnouncement: "afterTransfer",
        priceChooser: "receiver",
        priceRule: { kind: "range", min: 200, max: 800, step: 200 }
      };

      const published = await http
        .post("/v1/packages")
        .set("Cookie", hostA.cookie)
        .send({ content: fixture });
      expect(published.status).toBe(200);
      const packageId = published.body.id as number;
      expect(packageId).toBeGreaterThan(0);

      async function openSecret(host: typeof hostA) {
        const created = await http.post("/v1/games").set("Cookie", host.cookie).send({
          title: "Dynamic secret test",
          packageId,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 4
        });
        expect(created.status).toBe(200);
        const gameId = created.body.id as string;
        await utils.joinGame(host.socket, gameId, PlayerRole.SHOWMAN);
        const recipient = await utils.createGameClient(app, userRepo);
        const otherPlayer = await utils.createGameClient(app, userRepo);
        await utils.joinGame(recipient.socket, gameId, PlayerRole.PLAYER);
        await utils.joinGame(otherPlayer.socket, gameId, PlayerRole.PLAYER);
        await utils.startGame(host.socket);
        const question = (await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId,
          PackageQuestionTransferType.ANY
        ))!;
        const pickAccepted = scenario
          .createAcceptedActionProbe({ gameId, actionType: GameActionType.QUESTION_PICK })
          .waitForCount(1);
        await Promise.all([
          pickAccepted,
          scenario.emitAndWaitForEvent(
            host.socket,
            SocketIOGameEvents.SECRET_QUESTION_PICKED,
            () =>
              scenario.actor(host.socket).emit(SocketIOGameEvents.QUESTION_PICK, {
                questionId: question.id
              })
          )
        ]);
        const transferAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.SECRET_QUESTION_TRANSFER
          })
          .waitForCount(1);
        await Promise.all([
          transferAccepted,
          scenario.emitAndWaitForEvent(
            host.socket,
            SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
            () =>
              scenario.actor(host.socket).emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
                targetPlayerId: recipient.user.id
              })
          )
        ]);
        await scenario.assert.waitForActionsComplete({ gameId });
        return { gameId, host, recipient, questionId: question.id };
      }

      const gameA = await openSecret(hostA);
      const gameB = await openSecret(hostB);
      expect(gameA.gameId).not.toBe(gameB.gameId);
      expect(gameA.questionId).toBe(gameB.questionId);

      async function choosePrice(game: typeof gameA, price: number) {
        const accepted = scenario
          .createAcceptedActionProbe({
            gameId: game.gameId,
            actionType: GameActionType.SECRET_QUESTION_PRICE_SELECT
          })
          .waitForCount(1);
        const [shown] = await Promise.all([
          scenario.emitAndWaitForEvent<GameQuestionDataEventPayload>(
            game.host.socket,
            SocketIOGameEvents.QUESTION_DATA,
            () =>
              scenario
                .actor(game.recipient.socket)
                .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price })
          ),
          accepted
        ]);
        await scenario.assert.waitForActionsComplete({ gameId: game.gameId });
        expect(shown.data).toMatchObject({ id: game.questionId, price: 100, realPrice: price });
      }

      await choosePrice(gameA, 400);
      const beforeRuling = scenario.mark();
      const rulingAccepted = scenario
        .createAcceptedActionProbe({
          gameId: gameB.gameId,
          actionType: GameActionType.ANSWER_RESULT
        })
        .waitForCount(1);
      const [error] = await Promise.all([
        scenario.emitAndWaitForEvent<ErrorEventPayload>(hostB.socket, SocketIOEvents.ERROR, () =>
          scenario.actor(hostB.socket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            scoreResult: 100,
            answerType: AnswerResultType.CORRECT
          })
        ),
        rulingAccepted
      ]);
      await scenario.assert.waitForActionsComplete({ gameId: gameB.gameId });
      expect(error.message).toBe("Invalid question state");
      await scenario.assert.noInbound({
        actor: scenario.actor(hostB.socket),
        event: SocketIOGameEvents.ANSWER_RESULT,
        afterSequence: beforeRuling,
        durationMs: 100
      });
      const unresolved = await utils.getGameFromGameService(gameB.gameId);
      expect(unresolved.gameState).toMatchObject({
        questionState: QuestionState.SECRET_TRANSFER,
        currentQuestion: null,
        secretQuestionData: { priceSelection: { playerId: gameB.recipient.user.id } }
      });
      expect(unresolved.gameState.secretQuestionData?.realPrice ?? null).toBeNull();
      expect(unresolved.players.map((player) => player.score)).toEqual([0, 0, 0]);

      await choosePrice(gameB, 600);
      for (const [game, actual] of [
        [gameA, 400],
        [gameB, 600]
      ] as const) {
        const state = (await utils.getGameState(game.gameId))!;
        expect(state.currentQuestion).toMatchObject({ price: 100, realPrice: actual });
        const cell = state
          .currentRound!.themes.flatMap((theme) => theme.questions)
          .find((question) => question.id === game.questionId);
        expect(cell).toMatchObject({ price: 100, isPlayed: true });
      }
      const stored = await suite.dataSource.getRepository(PackageQuestion).findOneByOrFail({
        id: gameA.questionId
      });
      expect(stored).toMatchObject({
        price: 100,
        realPrice: null,
        secret_rules: secret.secretRules
      });
    });
  });

  it("scores a direct modern secret selection by option order at the receiver's price", async () => {
    await suite.scenario(async (scenario) => {
      const range = { min: 200, max: 600, step: 200 };
      const { gameId, playerSockets, playerUsers, showmanSocket, questionId, transfer } =
        await transferQuestion(scenario, (question) => {
          Object.assign(question, {
            subType: PackageQuestionSubType.SIMPLE,
            allowedPrices: null,
            questionFiles: null,
            secretRules: {
              outcome: "question",
              priceAnnouncement: "afterTransfer",
              priceChooser: "receiver",
              priceRule: { kind: "range", ...range }
            },
            answerType: AnswerType.SELECT,
            showDelay: 0,
            correctChoiceOrder: 1,
            selectSource: { rightLabels: ["B"] },
            answers: [
              { order: 0, text: "Same", sourceLabel: "A", file: null },
              { order: 1, text: "Same", sourceLabel: "B", file: null }
            ]
          });
        });
      const [other, receiver] = playerSockets;
      const receiverId = playerUsers[1].id;
      expect(transfer.secretQuestionData).toMatchObject({
        announcedRange: range,
        priceSelection: { playerId: receiverId, range }
      });
      await scenario.emitAndWaitForEvent(other, SocketIOEvents.ERROR, () =>
        scenario.actor(other).emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 400 })
      );
      const data = scenario.waitForEvent<GameQuestionDataEventPayload>(
        receiver,
        SocketIOGameEvents.QUESTION_DATA
      );
      const price = await scenario.emitAndWaitForEvent<SecretQuestionPriceBroadcastData>(
        other,
        SocketIOGameEvents.SECRET_QUESTION_PRICE,
        () =>
          scenario.actor(receiver).emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 400 })
      );
      expect(price).toMatchObject({ playerId: receiverId, questionId, price: 400 });
      const { data: shown, buzzerOpensAtMs } = await data;
      expect(shown).toMatchObject({ price: 100, realPrice: 400 });
      expect(shown.answers?.map(({ order, text }) => [order, text])).toEqual([
        [0, "Same"],
        [1, "Same"]
      ]);
      expect(shown).not.toHaveProperty("correctChoiceOrder");
      expect(shown).not.toHaveProperty("selectSource");

      await scenario.assert.waitForActionsComplete({ gameId });
      const game = await utils.getGameFromGameService(gameId);
      expect(game.gameState.questionState).toBe(QuestionState.ANSWERING);
      expect(game.gameState.answeringPlayer).toBe(receiverId);
      expect(buzzerOpensAtMs).toBeGreaterThan(0);
      game.gameState.timer!.startedAt = new Date(Date.now() + 10_000);
      await utils.updateGame(game);
      const submitChoice = () =>
        scenario.actor(receiver).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          answerText: "Same",
          choiceOrder: 1
        });
      const early = await scenario.emitAndWaitForEvent<ErrorEventPayload>(
        receiver,
        SocketIOEvents.ERROR,
        submitChoice
      );
      expect(early.message).toBe("You cannot submit answer on this question");
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))!.submittedChoiceOrder ?? null).toBeNull();

      game.gameState.timer!.startedAt = new Date(Date.now() - buzzerOpensAtMs!);
      await utils.updateGame(game);
      const accepted = scenario
        .createAcceptedActionProbe({
          gameId,
          actionType: GameActionType.ANSWER_SUBMITTED,
          socketId: receiver.id
        })
        .waitForCount(1);
      const { answerResult } = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT,
        submitChoice
      );
      await accepted;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(answerResult).toMatchObject({
        player: receiverId,
        answerType: AnswerResultType.CORRECT,
        choiceOrder: 1,
        result: 400,
        score: 400
      });
      const source = await container.resolve(PackageStore).getQuestionWithTheme(gameId, questionId);
      expect(source?.question).toMatchObject({ price: 100, realPrice: null });
    });
  });

  it("migrates nullable secret rules on existing PostgreSQL rows and rolls back", async () => {
    await suite.scenario(async () => {
      const runner = suite.dataSource.createQueryRunner();
      const migration = new AddSecretRules_0_34_1_1794418572612();
      try {
        await runner.startTransaction();
        await runner.query("CREATE TEMP TABLE p4_existing_questions (id integer)");
        await runner.query("INSERT INTO p4_existing_questions VALUES (1)");
        // The harness synchronizes its real schema; use an isolated pre-migration table to exercise the SQL.
        await runner.query("SET LOCAL search_path TO pg_temp");
        await runner.query("ALTER TABLE p4_existing_questions RENAME TO package_question");
        await migration.up(runner);
        expect(await runner.query("SELECT secret_rules FROM pg_temp.package_question")).toEqual([
          { secret_rules: null }
        ]);
        await runner.query("UPDATE pg_temp.package_question SET secret_rules = $1::jsonb", [
          JSON.stringify({ outcome: "award" })
        ]);
        expect(await runner.query("SELECT secret_rules FROM pg_temp.package_question")).toEqual([
          { secret_rules: { outcome: "award" } }
        ]);
        await migration.down(runner);
        expect(await runner.query("SELECT * FROM pg_temp.package_question")).toEqual([
          { id: 1 }
        ]);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });

  it("awards a transferred secret once under duplicate price and timeout, with private reconnect and score-only stats", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const q = pkg.rounds
          .flatMap((r) => r.themes)
          .flatMap((t) => t.questions)
          .find(
            (q) =>
              q.type === PackageQuestionType.SECRET &&
              q.transferType === PackageQuestionTransferType.ANY
          )!;
        q.subType = PackageQuestionSubType.SIMPLE;
        q.allowedPrices = null;
        q.realPrice = null;
        q.secretRules = {
          outcome: "award",
          priceAnnouncement: "afterTransfer",
          priceChooser: "receiver",
          priceRule: { kind: "range", min: 200, max: 1000000, step: 0 }
        };
        q.text = null;
        q.answerText = null;
        q.questionFiles = null;
        q.answerFiles = null;
      };
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      const { gameId, showmanSocket, playerSockets, playerUsers, spectatorSockets } = setup;
      const spectator = scenario.actor(spectatorSockets[0]);
      await utils.startGame(showmanSocket);
      const q = (await utils.findQuestionByType(
        PackageQuestionType.SECRET,
        gameId,
        PackageQuestionTransferType.ANY
      ))!;
      const pickAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.QUESTION_PICK })
        .waitForCount(1);
      const picked = scenario.waitForEvent(
        spectatorSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_PICKED
      );
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId: q.id });
      await Promise.all([pickAccepted, picked]);
      await scenario.assert.waitForActionsComplete({ gameId });
      let observer = playerSockets[0];
      const reconnectObserver = async () => {
        await utils.disconnectAndCleanup(observer);
        observer = (await utils.createSocketForExistingUser(app, playerUsers[0].id)).socket;
        return utils.joinGameWithSlotAndData(observer, gameId, PlayerRole.PLAYER, null);
      };
      const before = await reconnectObserver();
      expect(before.gameState.secretQuestionData).not.toHaveProperty("roundPrices");
      expect(before.gameState.secretQuestionData).not.toHaveProperty("announcedRange");
      expect(JSON.stringify(before.gameState)).not.toContain('"outcome"');
      const recipient = playerUsers[1].id;
      const transferAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.SECRET_QUESTION_TRANSFER })
        .waitForCount(1);
      const transfer = scenario.waitForEvent(
        spectatorSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_TRANSFER
      );
      scenario
        .actor(showmanSocket)
        .emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, { targetPlayerId: recipient });
      await Promise.all([transferAccepted, transfer]);
      await scenario.assert.waitForActionsComplete({ gameId });
      const beforeScore = (await utils.getGameState(gameId))!;
      const after = scenario.mark();
      const priceAccepted = scenario
        .createAcceptedActionProbe({
          gameId,
          actionType: GameActionType.SECRET_QUESTION_PRICE_SELECT,
          socketId: playerSockets[1].id
        })
        .waitForCount(2);
      const timerAccepted = scenario
        .createAcceptedActionProbe({
          gameId,
          actionType: GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
        })
        .waitForCount(1);
      const awarded = scenario.waitForEvent<SecretQuestionAwardedPayload>(
        spectatorSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_AWARDED
      );
      const [result] = await Promise.all([awarded, timerAccepted, TestUtils.expireTimer(gameId)]);
      await scenario.assert.waitForActionsComplete({ gameId });
      scenario
        .actor(playerSockets[1])
        .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 400 });
      scenario
        .actor(playerSockets[1])
        .emit(SocketIOGameEvents.SECRET_QUESTION_PRICE, { price: 400 });
      await priceAccepted;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(result.price).toBe(200);
      scenario.assert.expectDirectedEventCount({
        actor: spectator,
        direction: "inbound",
        event: SocketIOGameEvents.SECRET_QUESTION_AWARDED,
        afterSequence: after,
        expectedCount: 1
      });
      const state = (await utils.getGameState(gameId))!;
      expect(state.secretAward).toMatchObject({
        questionId: q.id,
        recipientPlayerId: recipient,
        price: result.price
      });
      expect(
        state.currentRound!.themes.flatMap((t) => t.questions).find((item) => item.id === q.id)
      ).toMatchObject({ price: q.price, isPlayed: true });
      expect(state.submittedAnswer).toBeNull();
      expect(state.answerShowData).toBeNull();
      expect(beforeScore.questionState).toBe(QuestionState.SECRET_TRANSFER);
      const stats = await container.resolve(PlayerGameStatsRepository).getStats(gameId, recipient);
      expect(stats).toMatchObject({
        currentScore: String(result.newScore),
        questionsAnswered: "0",
        correctAnswers: "0",
        wrongAnswers: "0"
      });
      const rejoined = await reconnectObserver();
      expect(rejoined.gameState.secretAward?.price).toBe(result.price);
      await scenario.assert.noInboundMany({
        actors: [
          spectator,
          scenario.actor(showmanSocket),
          scenario.actor(observer),
          scenario.actor(playerSockets[1])
        ],
        event: SocketIOGameEvents.ANSWER_SUBMITTED,
        afterSequence: after,
        durationMs: 100
      });
    });
  });

  it("finishes the last award cell without scoring when the only eligible receiver leaves", async () => {
    await suite.scenario(async (scenario) => {
      utils.packageTransform = (pkg) => {
        const round = pkg.rounds[0];
        const theme = round.themes[0];
        const question = theme.questions.find((q) => q.type === PackageQuestionType.SECRET)!;
        Object.assign(question, {
          order: 0,
          subType: PackageQuestionSubType.SIMPLE,
          transferType: PackageQuestionTransferType.EXCEPT_CURRENT,
          secretRules: {
            outcome: "award",
            priceAnnouncement: "afterTransfer",
            priceChooser: "receiver",
            priceRule: null
          },
          text: null,
          answerText: null,
          questionFiles: null,
          answerFiles: null
        });
        theme.questions = [question];
        round.themes = [theme];
        pkg.rounds = [round];
      };
      const { gameId, showmanSocket, playerSockets, playerUsers, spectatorSockets } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      await utils.startGame(showmanSocket);
      const q = (await utils.findQuestionByType(PackageQuestionType.SECRET, gameId))!;
      const spectator = scenario.actor(spectatorSockets[0]);
      const picked = scenario.waitForEvent<{ pickerPlayerId: number }>(
        spectatorSockets[0],
        SocketIOGameEvents.SECRET_QUESTION_PICKED
      );
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId: q.id });
      const { pickerPlayerId } = await picked;
      await utils.leaveGame(
        playerSockets[playerUsers.findIndex((user) => user.id !== pickerPlayerId)]
      );
      await scenario.assert.waitForActionsComplete({ gameId });

      const mark = scenario.mark();
      const finished = scenario.waitForEvent(spectatorSockets[0], SocketIOGameEvents.GAME_FINISHED);
      await suite.testUtils.expireTimerAndWaitForAction(
        gameId,
        GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
      );
      await finished;
      const game = await utils.getGameFromGameService(gameId);
      expect(game?.finishedAt).toBeTruthy();
      expect(game?.gameState.secretAward).toBeNull();
      expect(game?.gameState.timer).toBeNull();
      expect(game?.getPlayer(pickerPlayerId, { fetchDisconnected: false })?.score).toBe(0);
      scenario.assert.expectDirectedEventCount({
        actor: spectator,
        direction: "inbound",
        event: SocketIOGameEvents.SECRET_QUESTION_AWARDED,
        afterSequence: mark,
        expectedCount: 0
      });
    });
  });
});
