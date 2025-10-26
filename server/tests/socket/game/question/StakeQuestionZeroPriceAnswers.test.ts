import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";
import request from "supertest";
import { Repository } from "typeorm";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import {
  PackageQuestionDTO,
  PackageQuestionSubType,
} from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  AnswerSubmittedBroadcastData,
  AnswerSubmittedInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import {
  GameClientSocket,
  GameTestSetup,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Stake Question Zero Price Answer Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  async function createZeroPriceStakePackage(
    user: User,
    cookie: string
  ): Promise<number> {
    const packageData: PackageDTO = {
      title: "Zero Price Stake Test Package",
      description: "A package for testing zero price stake questions",
      ageRestriction: AgeRestriction.NONE,
      author: {
        id: user.id,
        username: user.username,
      },
      language: "en",
      logo: null,
      createdAt: new Date(),
      tags: [],
      rounds: [
        {
          name: "Test Round",
          description: "Round with zero price stake questions",
          order: 0,
          type: PackageRoundType.SIMPLE,
          themes: [
            {
              name: "Zero Price Stakes",
              description: "Theme with zero price stake questions",
              order: 0,
              questions: [
                {
                  type: PackageQuestionType.STAKE,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 0,
                  price: 0,
                  text: "What is 2 + 2?",
                  answerText: "4",
                  answerDelay: 5000,
                  maxPrice: 1,
                  isHidden: false,
                } satisfies PackageQuestionDTO,
                {
                  type: PackageQuestionType.STAKE,
                  subType: PackageQuestionSubType.SIMPLE,
                  order: 1,
                  price: 0,
                  text: "What is the capital of France?",
                  answerText: "Paris",
                  answerDelay: 5000,
                  maxPrice: 1,
                  isHidden: false,
                } satisfies PackageQuestionDTO,
              ],
            },
          ],
        },
      ],
    };

    const packageRes = await request(app)
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageData });

    if (packageRes.status !== 200) {
      throw new Error(
        `Failed to create package: ${packageRes.status} - ${JSON.stringify(
          packageRes.body
        )}`
      );
    }

    return packageRes.body.id;
  }

  async function setupZeroPriceStakeTest(): Promise<{
    setup: GameTestSetup;
    stakeQuestionId: number;
    cleanup: () => Promise<void>;
  }> {
    const {
      socket: showmanSocket,
      user: showmanUser,
      cookie,
    } = await utils.createGameClient(app, userRepo);

    const packageId = await createZeroPriceStakePackage(showmanUser, cookie);

    const gameData: GameCreateDTO = {
      title: "Zero Price Stake Test Game",
      packageId: packageId,
      isPrivate: false,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 10,
    };

    const gameRes = await request(app)
      .post("/v1/games")
      .set("Cookie", cookie)
      .send(gameData);

    if (gameRes.status !== 200) {
      throw new Error(
        `Failed to create game: ${gameRes.status} - ${JSON.stringify(
          gameRes.body
        )}`
      );
    }

    const createdGame = gameRes.body;
    const gameId = createdGame.id;

    await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

    const playerSockets: GameClientSocket[] = [];
    const playerUsers: User[] = [];
    const playerScores = [1000, 800, 600];

    for (let i = 0; i < 3; i++) {
      const { socket, user } = await utils.createGameClient(app, userRepo);
      await utils.joinGame(socket, gameId, PlayerRole.PLAYER);
      playerSockets.push(socket);
      playerUsers.push(user);
    }

    const setup: GameTestSetup = {
      gameId,
      showmanSocket,
      playerSockets,
      spectatorSockets: [],
      showmanUser,
      playerUsers,
    };

    await utils.startGame(showmanSocket);
    for (let i = 0; i < playerScores.length; i++) {
      await utils.setPlayerScore(gameId, playerUsers[i].id, playerScores[i]);
    }

    await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

    const stakeQuestionId = await utils.getQuestionIdByType(
      gameId,
      PackageQuestionType.STAKE
    );

    return {
      setup,
      stakeQuestionId,
      cleanup: async () => {
        await utils.cleanupGameClients(setup);
      },
    };
  }

  async function completeZeroPriceStakeBidding(
    setup: GameTestSetup,
    stakeQuestionId: number
  ): Promise<void> {
    const { showmanSocket, playerSockets } = setup;

    playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
      questionId: stakeQuestionId,
    });

    await utils.waitForEvent(
      showmanSocket,
      SocketIOGameEvents.STAKE_QUESTION_PICKED
    );

    const biddingResult = await handleZeroPriceBidding(
      showmanSocket,
      playerSockets
    );

    if (!biddingResult.biddingCompleted) {
      throw new Error(
        "Failed to complete zero price stake question bidding phase"
      );
    }

    const gameState = await utils.getGameState(setup.gameId);

    if (biddingResult.hasWinner) {
      expect(gameState?.questionState).toBe(QuestionState.SHOWING);
      expect(gameState?.stakeQuestionData?.biddingPhase).toBe(false);
      expect(gameState?.stakeQuestionData?.winnerPlayerId).toBe(
        biddingResult.winnerPlayerId
      );
    } else {
      throw new Error(
        "Expected a winner for zero price stake question with valid bid"
      );
    }
  }

  async function handleZeroPriceBidding(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[]
  ): Promise<{
    biddingCompleted: boolean;
    hasWinner: boolean;
    winnerPlayerId?: number;
  }> {
    try {
      playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
        bidType: StakeBidType.NORMAL,
        bidAmount: 1,
      });

      const player0BidResult =
        await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT,
          2000
        );

      if (!player0BidResult.isPhaseComplete) {
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        const player1BidResult =
          await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT,
            2000
          );

        if (!player1BidResult.isPhaseComplete) {
          playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.PASS,
            bidAmount: null,
          });

          await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT,
            2000
          );
        }
      }

      const game = await utils.getGameFromGameService(playerSockets[0].gameId!);
      const biddingCompleted = !game?.gameState.stakeQuestionData?.biddingPhase;
      const winnerPlayerId = game?.gameState.stakeQuestionData?.winnerPlayerId;
      const hasWinner = winnerPlayerId !== null && winnerPlayerId !== undefined;

      return {
        biddingCompleted,
        hasWinner,
        winnerPlayerId: winnerPlayerId || undefined,
      };
    } catch {
      return { biddingCompleted: false, hasWinner: false };
    }
  }

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
  });

  describe("Zero Price Stake Question Answer Scenarios", () => {
    it("should finish question when correct answer is submitted", async () => {
      const {
        setup,
        stakeQuestionId,
        cleanup: testCleanup,
      } = await setupZeroPriceStakeTest();
      const { showmanSocket, playerSockets } = setup;

      try {
        await completeZeroPriceStakeBidding(setup, stakeQuestionId);

        const questionFinishPromise =
          utils.waitForEvent<QuestionFinishEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_FINISH
          );

        const questionAnswerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );

        playerSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER);

        await questionAnswerPromise;

        playerSockets[0].emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          answerText: "Test answer",
        } as AnswerSubmittedInputData);

        await utils.waitForEvent<AnswerSubmittedBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SUBMITTED
        );

        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        const questionFinishEvent = await questionFinishPromise;

        expect(questionFinishEvent).toBeDefined();
        expect(questionFinishEvent.answerText).toBeDefined();
        expect(questionFinishEvent.nextTurnPlayerId).toBeDefined();

        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.questionState).toBe(QuestionState.CHOOSING);
        expect(gameState?.currentQuestion).toBeNull();
      } finally {
        await testCleanup();
      }
    });

    it("should continue showing question when wrong answer is submitted", async () => {
      const {
        setup,
        stakeQuestionId,
        cleanup: testCleanup,
      } = await setupZeroPriceStakeTest();
      const { showmanSocket, playerSockets } = setup;

      try {
        await completeZeroPriceStakeBidding(setup, stakeQuestionId);

        const questionAnswerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );

        playerSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER);

        await questionAnswerPromise;

        playerSockets[0].emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          answerText: "Wrong answer",
        } as AnswerSubmittedInputData);

        await utils.waitForEvent<AnswerSubmittedBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SUBMITTED
        );

        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.questionState).toBe(QuestionState.SHOWING);
        expect(gameState?.currentQuestion).not.toBeNull();
        expect(gameState?.answeringPlayer).toBeNull();
      } finally {
        await testCleanup();
      }
    });

    it("should reject skip attempt during showing phase", async () => {
      const {
        setup,
        stakeQuestionId,
        cleanup: testCleanup,
      } = await setupZeroPriceStakeTest();
      const { playerSockets } = setup;

      try {
        await completeZeroPriceStakeBidding(setup, stakeQuestionId);

        // Listen for error when trying to skip during showing phase
        const errorPromise = utils.waitForEvent(playerSockets[0], "error");

        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});

        const error = await errorPromise;
        expect(error.message).toContain("cannot skip while not answering");

        // Verify game state remains unchanged
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.questionState).toBe(QuestionState.SHOWING);
        expect(gameState?.currentQuestion).not.toBeNull();
        expect(gameState?.answeringPlayer).toBeNull();
      } finally {
        await testCleanup();
      }
    });
  });
});
