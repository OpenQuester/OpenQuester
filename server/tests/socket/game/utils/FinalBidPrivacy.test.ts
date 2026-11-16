import { describe, expect, it, jest } from "@jest/globals";
import { RealtimeEvents, type RealtimeEvent } from "application/ports/realtime/RealtimeEvent";
import type { RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import type { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import type { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { MAX_SCORE_DELTA, SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { projectFinalRoundData } from "domain/mappers/projectFinalRoundData";
import { AutoLossProcessLogic } from "domain/state-machine/logic/AutoLossProcessLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import type { FinalQuestionEventData } from "domain/types/socket/events/FinalRoundEventData";
import type { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import type { ILogger } from "shared/logging/ILogger";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

describe("final bid privacy boundaries", () => {
  it.each([FinalRoundPhase.BIDDING, FinalRoundPhase.ANSWERING])(
    "preserves readiness and hides others' amounts in %s snapshots",
    (phase) => {
      const data = {
        phase,
        turnOrder: [1, 2],
        bids: { 1: 700, 2: 500 },
        answers: [],
        eliminatedThemes: []
      };
      expect(projectFinalRoundData(data, 1)?.bids).toEqual({ 1: 700 });
      expect(projectFinalRoundData(data)?.bids).toEqual({});
      expect(projectFinalRoundData(data)?.submittedBidPlayerIds).toEqual([1, 2]);
      expect(projectFinalRoundData({ ...data, phase: FinalRoundPhase.REVIEWING })?.bids).toEqual(
        data.bids
      );
      expect(data.bids).toEqual({ 1: 700, 2: 500 });
    }
  );

  it.each(["empty answer", "timeout", "leave"])(
    "locks bids and defers %s penalties until review",
    (source) => {
      const player = {
        meta: { id: 1 },
        score: 1000,
        role: PlayerRole.PLAYER,
        gameStatus: PlayerGameStatus.IN_GAME
      };
      const data = {
        phase: FinalRoundPhase.BIDDING,
        turnOrder: [1],
        bids: {},
        answers: [],
        eliminatedThemes: []
      };
      const game = {
        players: [player],
        gameState: { finalRoundData: data, questionState: QuestionState.ANSWERING },
        getPlayer: () => player,
        setQuestionState: jest.fn()
      } as unknown as Game;
      FinalRoundStateManager.addBid(game, 1, 700);
      expect(() => FinalRoundStateManager.addBid(game, 1, 100)).toThrow(
        "final_bid_already_submitted"
      );
      expect(data.bids).toEqual({ 1: 700 });
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);
      if (source === "timeout") {
        expect(AutoLossProcessLogic.processAutoLoss(game, data).autoLossPlayerIds).toEqual([1]);
        expect(AutoLossProcessLogic.processAutoLoss(game, data).autoLossPlayerIds).toEqual([]);
      } else if (source === "leave") {
        expect(AutoLossProcessLogic.processPlayerAutoLoss(game, 1)?.playerId).toBe(1);
        expect(AutoLossProcessLogic.processPlayerAutoLoss(game, 1)).toBeNull();
      } else {
        FinalRoundStateManager.addAnswer(game, 1, "", true);
      }
      expect(player.score).toBe(1000);
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
      expect(player.score).toBe(300);
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
      expect(player.score).toBe(300);
      expect(FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game)[0]).toMatchObject({
        playerId: 1,
        scoreAfter: 300
      });
    }
  );

  it.each(["empty room", "empty map", "lookup failure"])(
    "publishes one sanitized paused snapshot after %s",
    async (failure) => {
      const publish = jest.fn<(event: RealtimeEvent) => void>();
      const gateway = {
        publish,
        getRoomSocketIds: async () => (failure === "empty room" ? [] : ["unknown"])
      } as unknown as RealtimeGateway;
      const questionService = {
        getGameStateBroadcastMap: async () => {
          if (failure === "lookup failure") {
            throw new Error("session lookup unavailable");
          }
          return new Map();
        }
      } as unknown as SocketIOQuestionService;
      const service = new GameActionBroadcastService(
        gateway,
        questionService,
        {} as SocketUserDataService,
        { error: jest.fn() } as unknown as ILogger
      );
      const privateAnswer = {
        id: "answer",
        playerId: 1,
        answer: "private",
        choiceOrder: 2,
        submittedAt: new Date(0)
      };
      const finalRoundData = {
        phase: FinalRoundPhase.ANSWERING,
        turnOrder: [1],
        bids: { 1: 700 },
        answers: [privateAnswer],
        eliminatedThemes: []
      };
      const game = buildGame("quiz", null);
      const gameState = game.gameState;
      gameState.currentRound!.type = PackageRoundType.FINAL;
      gameState.questionState = QuestionState.ANSWERING;
      gameState.isPaused = true;
      gameState.finalRoundData = finalRoundData;
      // Old persisted states may omit the optional secret and reveal fields.
      delete gameState.secretQuestionData;
      delete gameState.answerShowData;
      await service.emitBroadcasts(
        [
          {
            target: SocketBroadcastTarget.GAME,
            event: SocketIOGameEvents.GAME_DATA,
            data: {},
            useRoleBasedBroadcast: true
          }
        ],
        game
      );
      expect(publish.mock.calls).toStrictEqual([
        [
          RealtimeEvents.toRoom("quiz", SocketIOGameEvents.GAME_DATA, {
            gameState: {
              ...gameState,
              finalRoundData: {
                ...finalRoundData,
                bids: {},
                submittedBidPlayerIds: [1],
                answers: [{ ...privateAnswer, answer: "", choiceOrder: undefined }]
              }
            }
          })
        ]
      ]);
      expect(finalRoundData.bids).toEqual({ 1: 700 });
      expect(finalRoundData.answers[0]).toMatchObject({ answer: "private", choiceOrder: 2 });
      expect(gameState).not.toHaveProperty("secretQuestionData");
      expect(gameState).not.toHaveProperty("answerShowData");
    }
  );

  it("returns only public state when a socket has no verified game session", async () => {
    const sessions = new Map([
      ["owner", { id: 1, gameId: "quiz" }],
      ["stale", { id: 1, gameId: "other" }]
    ]);
    const service = new SocketIOQuestionService(
      {
        fetchUserSocketDataBatch: async () => sessions
      } as unknown as SocketGameContextService,
      {
        performance: () => ({ finish: jest.fn() })
      } as unknown as ILogger
    );
    const game = {
      id: "quiz",
      getPlayer: () => ({ meta: { id: 1 }, role: PlayerRole.PLAYER }),
      gameState: {
        currentRound: { type: PackageRoundType.FINAL, themes: [] },
        questionState: QuestionState.MEDIA_DOWNLOADING,
        finalRoundData: {
          phase: FinalRoundPhase.ANSWERING,
          turnOrder: [1],
          bids: { 1: 700 },
          answers: [],
          eliminatedThemes: []
        }
      }
    } as unknown as Game;
    const states = await service.getGameStateBroadcastMap(["owner", "stale", "missing"], game);
    expect(states.get("owner")?.finalRoundData?.bids).toEqual({ 1: 700 });
    for (const socketId of ["stale", "missing"]) {
      expect(states.get(socketId)?.finalRoundData?.bids).toEqual({});
      expect(states.get(socketId)?.finalRoundData?.submittedBidPlayerIds).toEqual([1]);
    }
  });

  it("delivers public question data to every room socket without a verified session", async () => {
    const sockets = ["verified", "stale", "missing"];
    const sessions = new Map([
      ["verified", { id: 1, gameId: "quiz" }],
      ["stale", { id: 1, gameId: "other" }]
    ]);
    const game = buildGame("quiz", null);
    const question = { ...game.gameState.currentQuestion!, answerText: "showman only" };
    const publish = jest.fn<(event: RealtimeEvent) => void>();
    const logger = { performance: () => ({ finish: jest.fn() }), warn: jest.fn() } as unknown as ILogger;
    const fetchUserSocketDataBatch = jest
      .fn<() => Promise<typeof sessions>>()
      .mockResolvedValueOnce(sessions)
      .mockRejectedValueOnce(new Error("session lookup unavailable"));
    const questionService = new SocketIOQuestionService(
      { fetchUserSocketDataBatch } as unknown as SocketGameContextService,
      logger
    );
    const questionBySocket = await questionService.mapSocketToQuestionPayload(sockets, game, question);
    expect(questionBySocket.get("verified")).toHaveProperty("answerText", "showman only");
    for (const socket of ["stale", "missing"]) {
      expect(questionBySocket.get(socket)).toHaveProperty("id", question.id);
      expect(questionBySocket.get(socket)).not.toHaveProperty("answerText");
    }
    const publicQuestions = await questionService.mapSocketToQuestionPayload(sockets, game, question);
    expect([...publicQuestions.values()]).toEqual(sockets.map(() => questionBySocket.get("missing")));

    const service = new GameActionBroadcastService(
      { publish, getRoomSocketIds: async () => sockets } as unknown as RealtimeGateway,
      questionService,
      { getSocketDataBatch: async () => sessions } as unknown as SocketUserDataService,
      logger
    );
    const event = SocketIOGameEvents.QUESTION_SCRIPT_STATE;
    const data = { question, scores: [] };
    await service.emitBroadcasts([{ target: SocketBroadcastTarget.GAME, event, data }], game);
    expect(publish).toHaveBeenCalledTimes(3);
    for (const [index, socket] of sockets.entries()) {
      expect(publish).toHaveBeenNthCalledWith(
        index + 1,
        RealtimeEvents.toSocket(socket, event, {
          gameState: expect.objectContaining({ currentQuestion: questionBySocket.get(socket) }),
          scores: [],
          outcomes: undefined
        })
      );
    }
  });

  it("sends room readiness before the private amount and fails closed on session errors", async () => {
    const publish = jest.fn<(event: RealtimeEvent) => void>();
    const getRoomSocketIds = jest
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(["owner", "showman", "opponent", "spectator", "stale"]);
    const gateway = { publish, getRoomSocketIds } as unknown as RealtimeGateway;
    const sessions = new Map([
      ["owner", { id: 1, gameId: "quiz" }],
      ["showman", { id: 2, gameId: "quiz" }],
      ["opponent", { id: 3, gameId: "quiz" }],
      ["spectator", { id: 4, gameId: "quiz" }],
      ["stale", { id: 1, gameId: "other" }]
    ]);
    const socketUsers = {
      getSocketDataBatch: jest
        .fn<() => Promise<typeof sessions>>()
        .mockResolvedValueOnce(sessions)
        .mockRejectedValueOnce(new Error("session lookup unavailable"))
    } as unknown as SocketUserDataService;
    const error = jest.fn();
    const service = new GameActionBroadcastService(
      gateway,
      {} as SocketIOQuestionService,
      socketUsers,
      { error } as unknown as ILogger
    );
    const event = SocketIOGameEvents.FINAL_BID_SUBMIT;
    const data = { playerId: 1, bidAmount: 700 };
    const game = { id: "quiz" } as Game;
    const broadcasts = [{ target: SocketBroadcastTarget.GAME, event, data }];
    await service.emitBroadcasts(
      [{ ...broadcasts[0], data: { playerId: 1 } }],
      game
    );
    expect(publish).not.toHaveBeenCalled();
    expect(getRoomSocketIds).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      gameId: "quiz",
      playerId: 1
    }));
    await service.emitBroadcasts(broadcasts, game);
    await service.emitBroadcasts([{ ...broadcasts[0], useRoleBasedBroadcast: true }], game);
    expect(publish.mock.calls).toEqual([
      [RealtimeEvents.toRoom("quiz", event, { playerId: 1 })],
      [RealtimeEvents.toSocket("owner", event, data)],
      [RealtimeEvents.toRoom("quiz", event, { playerId: 1 })]
    ]);
  });

  it("routes ordinary broadcasts, both question payloads and addressed state in order", async () => {
    const publish = jest.fn<(event: RealtimeEvent) => void>();
    const publicQuestion = {
      id: 7,
      type: PackageQuestionType.SIMPLE,
      price: 100,
      order: 0,
      isHidden: false,
      answerDelay: 0,
      showAnswerDuration: 5000,
      subType: PackageQuestionSubType.SIMPLE
    };
    const fullQuestion = { ...publicQuestion, answerText: "secret" };
    const finalRoundData = {
      phase: FinalRoundPhase.ANSWERING,
      turnOrder: [1, 2],
      bids: { 1: 700, 2: 500 },
      answers: [],
      eliminatedThemes: []
    };
    const game = buildGame("quiz", null);
    const gameState = game.gameState;
    gameState.questionState = QuestionState.MEDIA_DOWNLOADING;
    gameState.finalRoundData = finalRoundData;
    const addressedState = {
      ...gameState,
      finalRoundData: { ...finalRoundData, submittedBidPlayerIds: [1, 2], bids: { 1: 700 } }
    };
    const gateway = {
      publish,
      getRoomSocketIds: async () => ["owner"]
    } as unknown as RealtimeGateway;
    const questionService = {
      mapSocketToQuestionPayload: async () => new Map([["owner", publicQuestion]]),
      getGameStateBroadcastMap: async () => new Map([["owner", addressedState]])
    } as unknown as SocketIOQuestionService;
    const error = jest.fn();
    const service = new GameActionBroadcastService(
      gateway,
      questionService,
      {} as SocketUserDataService,
      { error } as unknown as ILogger
    );
    const room = { target: SocketBroadcastTarget.GAME };
    const filtered = { ...room, useRoleBasedBroadcast: true };
    const regular: GameQuestionDataEventPayload = { data: fullQuestion, timer: null };
    const final: FinalQuestionEventData = {
      questionData: { themeId: 1, themeName: "Final", question: fullQuestion }
    };
    const { FINAL_ANSWER_SUBMIT, QUESTION_DATA, FINAL_QUESTION_DATA, GAME_DATA } = SocketIOGameEvents;
    await service.emitBroadcasts(
      [
        { ...room, event: FINAL_ANSWER_SUBMIT, data: { playerId: 1 } },
        { ...filtered, event: QUESTION_DATA, data: regular },
        { ...filtered, event: FINAL_QUESTION_DATA, data: final },
        { ...filtered, event: GAME_DATA, data: {} }
      ],
      game
    );
    expect(error).not.toHaveBeenCalled();
    expect(publish.mock.calls).toStrictEqual([
      [RealtimeEvents.toRoom("quiz", FINAL_ANSWER_SUBMIT, { playerId: 1 })],
      [
        RealtimeEvents.toSocket("owner", QUESTION_DATA, {
          timer: null,
          questionState: QuestionState.MEDIA_DOWNLOADING,
          data: publicQuestion
        })
      ],
      [
        RealtimeEvents.toSocket("owner", FINAL_QUESTION_DATA, {
          questionData: { themeId: 1, themeName: "Final", question: publicQuestion }
        })
      ],
      [RealtimeEvents.toSocket("owner", GAME_DATA, { gameState: addressedState })]
    ]);
  });

  it("settles disconnected players with both score clamps and handles a missing player", () => {
    const players = [
      { meta: { id: 1 }, gameStatus: PlayerGameStatus.DISCONNECTED, score: 5_000_000 },
      { meta: { id: 2 }, gameStatus: PlayerGameStatus.DISCONNECTED, score: -SCORE_ABS_LIMIT + 1 }
    ];
    const game = new Game({
      players,
      gameState: { questionState: QuestionState.ANSWERING }
    } as ConstructorParameters<typeof Game>[0]);
    const data = FinalRoundStateManager.initializeFinalRoundData(game);
    data.phase = FinalRoundPhase.ANSWERING;
    data.bids = { 1: MAX_SCORE_DELTA + 1, 2: 10, 3: 100 };
    for (const playerId of [1, 2, 3]) {
      FinalRoundStateManager.addAnswer(game, playerId, "", true);
    }
    expect(FinalRoundStateManager.getBidConstraints(game, 1).playerScore).toBe(5_000_000);
    expect(() => FinalRoundStateManager.getBidConstraints(game, 3)).toThrow("player_not_found");
    expect(players.map(({ score }) => score)).toEqual([5_000_000, -SCORE_ABS_LIMIT + 1]);

    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
    const reviewedAt = data.answers.map((answer) => answer.reviewedAt);
    expect(reviewedAt).toEqual([expect.any(Date), expect.any(Date), expect.any(Date)]);
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
    expect(data.answers.map((answer) => answer.reviewedAt)).toEqual(reviewedAt);
    expect(players.map(({ score }) => score)).toEqual([5_000_000 - MAX_SCORE_DELTA, -SCORE_ABS_LIMIT]);
    expect(FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game)).toMatchObject([
      { playerId: 1, scoreAfter: 5_000_000 - MAX_SCORE_DELTA },
      { playerId: 2, scoreAfter: -SCORE_ABS_LIMIT },
      { playerId: 3, scoreAfter: undefined }
    ]);
  });
});
