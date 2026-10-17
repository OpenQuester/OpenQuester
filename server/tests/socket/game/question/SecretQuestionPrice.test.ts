import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
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
  async function transferCustomPriceQuestion(scenario: GameScenario) {
    utils.packageTransform = (pkg) => {
      const secret = pkg.rounds
        .flatMap(({ themes }) => themes)
        .flatMap(({ questions }) => questions)
        .find(
          (q) =>
            q.type === PackageQuestionType.SECRET &&
            q.transferType === PackageQuestionTransferType.ANY
        )!;
      secret.subType = PackageQuestionSubType.CUSTOM_PRICE;
      secret.allowedPrices = PRICES;
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

      expect(picked).toEqual({ playerId: playerUsers[1].id, price: 200, questionId });
      expect((await questionData).data.price).toBe(200);

      const state = await utils.getGameState(gameId);
      expect(state!.questionState).toBe(QuestionState.ANSWERING);
      expect(state!.answeringPlayer).toBe(playerUsers[1].id);
      expect(state!.currentQuestion!.price).toBe(200);
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

      expect((await utils.getGameState(gameId))!.questionState).toBe(
        QuestionState.SECRET_TRANSFER
      );
    });
  });
});
