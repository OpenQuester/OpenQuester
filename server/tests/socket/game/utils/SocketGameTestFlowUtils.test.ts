import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { createControlledPromise } from "tests/e2e/harness/TestPromiseUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

import { GAME_QUESTION_ANSWER_TIME, MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { type Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import {
  PackageQuestionSubType,
  type PackageQuestionDTO
} from "domain/types/dto/package/PackageQuestionDTO";
import { type PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SocketGameTestFlowUtils } from "tests/socket/game/utils/SocketGameTestFlowUtils";
import { type SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestStateUtils } from "tests/socket/game/utils/SocketGameTestStateUtils";
import { type GameClientSocket } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { type SocketGameTestUserUtils } from "tests/socket/game/utils/SocketGameTestUserUtils";

afterEach(() => {
  jest.useRealTimers();
});

describe("SocketGameTestFlowUtils reliability", () => {
  it("owns a forgotten helper's validation after its QUESTION_DATA wait resolves", async () => {
    const scenario = new GameScenario();
    const { flow, stateUtils, showman, players } = createRegularMediaFixture(true, scenario);
    stateUtils.getGameState.mockResolvedValue({ questionState: QuestionState.SHOWING });
    void flow.pickQuestion(showman, 42, players);
    await expect(scenario.finish()).rejects.toThrow("expected media_downloading");
    players.forEach((player) => expect(player.emit).not.toHaveBeenCalled());
  });

  it("bounds a forgotten helper when its initial state dependency never returns", async () => {
    jest.useFakeTimers();
    const scenario = new GameScenario();
    const { flow, stateUtils, showman, players } = createRegularMediaFixture(true, scenario);
    stateUtils.getGame.mockReturnValue(createControlledPromise().promise);
    void flow.pickQuestion(showman, 42, players);
    const finished = expect(scenario.finish()).rejects.toThrow("getGame in game flow");
    await jest.advanceTimersByTimeAsync(TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    await finished;
    expect(jest.getTimerCount()).toBe(0);
    expect(showman.emit).not.toHaveBeenCalled();
  });
  it("rejects instead of silently skipping an unexpected media phase", async () => {
    const { flow, stateUtils } = createFixture();
    stateUtils.getGameState.mockResolvedValue({
      questionState: QuestionState.SHOWING
    });

    await expect(
      flow.waitForMediaDownload(createSocket("game-1"), [createSocket("game-1")])
    ).rejects.toThrow(
      `expected ${QuestionState.MEDIA_DOWNLOADING}, received ${QuestionState.SHOWING}`
    );
  });

  it.each([
    ["stake bidding", SocketIOGameEvents.STAKE_QUESTION_PICKED],
    ["secret transfer", SocketIOGameEvents.SECRET_QUESTION_PICKED],
    ["one-player secret fallback", SocketIOGameEvents.QUESTION_DATA]
  ])("keeps %s outside the regular media gate", async (_name, expectedEvent) => {
    const { flow, stateUtils, eventUtils } = createFixture();
    const showman = createSocket("game-1");
    const player = createSocket("game-1");
    stateUtils.getGame.mockResolvedValue({
      gameState: { currentRound: {} }
    } as Game);
    jest
      .spyOn(
        flow as unknown as {
          _determineQuestionPickExpectation: (
            game: Game,
            questionId: number
          ) => Promise<QuestionPickExpectation>;
        },
        "_determineQuestionPickExpectation"
      )
      .mockResolvedValue({
        event: expectedEvent,
        mediaHandshake: false,
        question: createQuestion(createQuestionFiles())
      });

    await flow.pickQuestion(showman, 42, [player]);

    expect(eventUtils.emitAndWaitForEvent).toHaveBeenCalledWith(
      showman,
      expectedEvent,
      expect.any(Function)
    );
    expect(eventUtils.waitForEventMatching).not.toHaveBeenCalled();
    expect(eventUtils.waitForNoEvent).not.toHaveBeenCalled();
    expect(showman.emit).toHaveBeenCalledWith(SocketIOGameEvents.QUESTION_PICK, {
      questionId: 42
    });
  });

  it.each([true, false])(
    "uses QUESTION_DATA then player ACKs (has files: %s)",
    async (hasFiles) => {
      const { flow, showman, players, eventUtils, userUtils } = createRegularMediaFixture(hasFiles);
      await expect(flow.pickQuestion(showman, 42, players)).resolves.toBeUndefined();
      expect(eventUtils.waitForEventMatching).toHaveBeenCalledTimes(3);
      expect(eventUtils.waitForEventMatching.mock.calls.map((call) => call[1])).toEqual([
        SocketIOGameEvents.QUESTION_DATA,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
      ]);
      for (const [index, player] of players.entries()) {
        expect(userUtils.getUserIdFromSocket).toHaveBeenNthCalledWith(index + 1, player);
        expect(player.emit).toHaveBeenCalledTimes(1);
        expect(eventUtils.waitForEventMatching.mock.invocationCallOrder[index + 1]).toBeLessThan(
          (player.emit as jest.Mock).mock.invocationCallOrder[0]
        );
      }
      expect(eventUtils.waitForEventMatching.mock.invocationCallOrder[0]).toBeLessThan(
        (showman.emit as jest.Mock).mock.invocationCallOrder[0]
      );
      expect(eventUtils.waitForNoEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      "skipped media phase",
      QuestionState.SHOWING,
      MEDIA_DOWNLOAD_TIMEOUT,
      "expected media_downloading"
    ],
    [
      "wrong active media timer",
      QuestionState.MEDIA_DOWNLOADING,
      GAME_QUESTION_ANSWER_TIME,
      "fresh 10000ms timer"
    ]
  ])(
    "rejects correct QUESTION_DATA with %s before sending any ACK",
    async (_name, questionState, duration, message) => {
      const { flow, showman, players, stateUtils, question } = createRegularMediaFixture();
      stateUtils.getGameState.mockResolvedValue({
        ...mediaDownloadingState(question),
        questionState,
        timer: timer(duration)
      });
      await expect(flow.pickQuestion(showman, 42, players)).rejects.toThrow(message);
      players.forEach((player) => expect(player.emit).not.toHaveBeenCalled());
    }
  );

  it.each(["missing files", "missing link", "wrong payload timer"] as const)(
    "rejects %s in QUESTION_DATA",
    async (defect) => {
      const { flow, showman, players, events, question } = createRegularMediaFixture();
      const data = questionData(42, question.questionFiles ?? []);
      if (defect === "missing files") data.data.questionFiles = [];
      if (defect === "missing link") {
        data.data.questionFiles = createQuestionFiles().map((entry) => ({
          ...entry,
          file: { ...entry.file, link: undefined }
        }));
      }
      if (defect === "wrong payload timer") data.timer = timer(GAME_QUESTION_ANSWER_TIME);
      (showman.emit as jest.Mock).mockImplementation(() =>
        events.emit(SocketIOGameEvents.QUESTION_DATA, data)
      );
      await expect(flow.pickQuestion(showman, 42, players)).rejects.toThrow(
        defect === "wrong payload timer" ? "fresh 10000ms timer" : "files mismatch"
      );
      players.forEach((player) => expect(player.emit).not.toHaveBeenCalled());
    }
  );

  it("rejects an early phase transition even if a partial status claims the barrier is still closed", async () => {
    const { flow, showman, players, events, stateUtils, question } = createRegularMediaFixture();
    (players[0].emit as jest.Mock).mockImplementation(() => {
      stateUtils.getGameState.mockResolvedValue({
        ...mediaDownloadingState(question),
        questionState: QuestionState.SHOWING
      });
      events.emit(SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, mediaStatus(11, true, false));
    });
    await expect(flow.pickQuestion(showman, 42, players)).rejects.toThrow(
      "expected media_downloading"
    );
    expect(players[1].emit).not.toHaveBeenCalled();
  });

  it("matches every acknowledgement to the requested player's status", async () => {
    const { flow, showman, players, events } = createRegularMediaFixture();
    (players[0].emit as jest.Mock).mockImplementation(() => {
      events.emit(SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, mediaStatus(99, true, false));
      events.emit(SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, mediaStatus(11, true, false));
    });
    await expect(flow.waitForMediaDownload(showman, players)).resolves.toBeUndefined();
    players.forEach((player) => expect(player.emit).toHaveBeenCalledTimes(1));
  });

  it.each([
    {
      name: "media not downloaded",
      statuses: [mediaStatus(11, false, false)],
      expectedMessage: "mediaDownloaded=true",
      expectedEmitCounts: [1, 0]
    },
    {
      name: "premature all-ready status",
      statuses: [mediaStatus(11, true, true)],
      expectedMessage: "allPlayersReady=false",
      expectedEmitCounts: [1, 0]
    },
    {
      name: "final player still not all ready",
      statuses: [mediaStatus(11, true, false), mediaStatus(12, true, false)],
      expectedMessage: "allPlayersReady=true",
      expectedEmitCounts: [1, 1]
    },
    {
      name: "wrong final timer",
      statuses: [
        mediaStatus(11, true, false),
        { ...mediaStatus(12, true, true), timer: timer(MEDIA_DOWNLOAD_TIMEOUT) }
      ],
      expectedMessage: `fresh ${GAME_QUESTION_ANSWER_TIME}ms timer`,
      expectedEmitCounts: [1, 1]
    }
  ])("fails immediately on $name", async ({ statuses, expectedMessage, expectedEmitCounts }) => {
    const { flow, showman, players, events, eventUtils } = createRegularMediaFixture();
    players.forEach((player, index) => {
      (player.emit as jest.Mock).mockImplementation(() =>
        events.emit(SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, statuses[index])
      );
    });
    await expect(flow.waitForMediaDownload(showman, players)).rejects.toThrow(expectedMessage);
    players.forEach((player, index) =>
      expect(player.emit).toHaveBeenCalledTimes(expectedEmitCounts[index])
    );
    expect(eventUtils.waitForEventMatching).toHaveBeenCalledTimes(
      expectedEmitCounts[0] + expectedEmitCounts[1]
    );
  });

  it("uses a bounded predicate wait for the requested player readiness", async () => {
    const { flow, eventUtils } = createFixture();
    const socket = createSocket("game-1");
    eventUtils.waitForEventMatching.mockResolvedValue({ playerId: 2 });

    await expect(flow.waitForPlayerReady(socket, 2)).resolves.toEqual({ playerId: 2 });

    const predicate = eventUtils.waitForEventMatching.mock.calls[0][2] as (data: {
      playerId: number;
    }) => boolean;
    expect(predicate({ playerId: 1 })).toBe(false);
    expect(predicate({ playerId: 2 })).toBe(true);
  });

  it("returns a rejected promise when a readiness wait cannot be armed", async () => {
    const { flow, eventUtils } = createFixture();
    const failure = new Error("socket is disconnected");
    eventUtils.waitForEventMatching.mockImplementation(() => {
      throw failure;
    });

    const wait = flow.waitForPlayerReady(createSocket("game-1"), 2);

    await expect(wait).rejects.toBe(failure);
  });

  it("does not swallow a missing show-answer event when state requires it", async () => {
    const { flow, stateUtils, eventUtils } = createFixture();
    const showman = createSocket("game-1");
    const player = createSocket("game-1");
    eventUtils.waitForEvent.mockRejectedValue(new Error("missing ANSWER_SHOW_START"));
    eventUtils.emitAndWaitForEvent.mockResolvedValue({});
    stateUtils.getGame.mockResolvedValue({
      finishedAt: null,
      gameState: { questionState: QuestionState.SHOWING_ANSWER }
    });

    await expect(
      (
        flow as unknown as {
          _submitAnswerResultWithQuestionComplete: (
            showmanSocket: GameClientSocket,
            playerSocket: GameClientSocket,
            answerType: number,
            score: number
          ) => Promise<void>;
        }
      )._submitAnswerResultWithQuestionComplete(showman, player, 0, 100)
    ).rejects.toThrow("missing ANSWER_SHOW_START");
  });

  it("rejects when answer-result handling leaves the question in an unexpected state", async () => {
    const { flow, stateUtils, eventUtils } = createFixture();
    const showman = createSocket("game-1", "showman");
    const player = createSocket("game-1", "player");
    eventUtils.waitForEvent.mockResolvedValue({});
    eventUtils.emitAndWaitForEvent.mockResolvedValue({});
    stateUtils.getGame.mockResolvedValue({
      finishedAt: null,
      gameState: { questionState: QuestionState.ANSWERING }
    });

    await expect(
      stakeInternals(flow)._submitAnswerResultWithQuestionComplete(
        showman,
        player,
        AnswerResultType.CORRECT,
        100
      )
    ).rejects.toThrow(
      `expected ${QuestionState.SHOWING_ANSWER} or ${QuestionState.SHOWING}, received ${QuestionState.ANSWERING}`
    );
  });

  it("rejects stake completion when sockets omit an active player", async () => {
    const { flow, stateUtils, eventUtils, userUtils } = createFixture();
    const showman = createSocket("game-1", "showman");
    const sockets = [createSocket("game-1", "player-1"), createSocket("game-1", "unrelated-99")];
    stateUtils.getGame.mockResolvedValue(
      createGameWithPlayers([
        playerState(1, PlayerRole.PLAYER, PlayerGameStatus.IN_GAME),
        playerState(2, PlayerRole.PLAYER, PlayerGameStatus.IN_GAME)
      ])
    );
    userUtils.getUserIdFromSocket.mockImplementation(async (socket) =>
      socket.id === "player-1" ? 1 : 99
    );
    const skipQuestion = jest.spyOn(flow, "skipQuestionForceComplete").mockResolvedValue();

    await expect(
      stakeInternals(flow)._handleStakeQuestionComplete(
        showman,
        sockets,
        "game-1",
        42,
        false,
        AnswerResultType.CORRECT,
        100
      )
    ).rejects.toThrow(/missingPlayerIds=\[2\].*unexpectedPlayerIds=\[99\]/);

    expect(eventUtils.emitAndWaitForEvent).not.toHaveBeenCalled();
    expect(showman.emit).not.toHaveBeenCalled();
    expect(skipQuestion).not.toHaveBeenCalled();
  });

  it("requires sockets only for active stake players", async () => {
    const { flow, stateUtils, eventUtils, userUtils } = createFixture();
    const showman = createSocket("game-1", "showman");
    const activePlayer = createSocket("game-1", "player-1");
    stateUtils.getGame.mockResolvedValue(
      createGameWithPlayers([
        playerState(1, PlayerRole.PLAYER, PlayerGameStatus.IN_GAME),
        playerState(2, PlayerRole.SPECTATOR, PlayerGameStatus.IN_GAME),
        playerState(3, PlayerRole.PLAYER, PlayerGameStatus.DISCONNECTED)
      ])
    );
    userUtils.getUserIdFromSocket.mockResolvedValue(1);
    const skipQuestion = jest.spyOn(flow, "skipQuestionForceComplete").mockResolvedValue();

    await expect(
      stakeInternals(flow)._handleStakeQuestionComplete(
        showman,
        [activePlayer],
        "game-1",
        42,
        false,
        AnswerResultType.CORRECT,
        100
      )
    ).resolves.toBeUndefined();

    expect(eventUtils.emitAndWaitForEvent).toHaveBeenCalledTimes(1);
    expect(showman.emit).toHaveBeenCalledWith(SocketIOGameEvents.QUESTION_PICK, {
      questionId: 42
    });
    expect(skipQuestion).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate sockets for one active stake player", async () => {
    const { flow, stateUtils, eventUtils, userUtils } = createFixture();
    const showman = createSocket("game-1", "showman");
    const firstSocket = createSocket("game-1", "player-1-a");
    const duplicateSocket = createSocket("game-1", "player-1-b");
    stateUtils.getGame.mockResolvedValue(
      createGameWithPlayers([playerState(1, PlayerRole.PLAYER, PlayerGameStatus.IN_GAME)])
    );
    userUtils.getUserIdFromSocket.mockResolvedValue(1);

    await expect(
      stakeInternals(flow)._handleStakeQuestionComplete(
        showman,
        [firstSocket, duplicateSocket],
        "game-1",
        42,
        false,
        AnswerResultType.CORRECT,
        100
      )
    ).rejects.toThrow("duplicatePlayerIds=[1]");

    expect(eventUtils.emitAndWaitForEvent).not.toHaveBeenCalled();
    expect(showman.emit).not.toHaveBeenCalled();
  });

  it("rejects a stake winner event without a winner", async () => {
    const { flow, stateUtils, eventUtils } = createFixture();
    stateUtils.getGame.mockResolvedValue(createStakeBiddingGame());
    eventUtils.waitForEvent.mockResolvedValue({});

    await expect(
      stakeInternals(flow).completeBiddingPhase(
        createSocket("game-1", "showman"),
        [createSocket("game-1", "player-1")],
        "game-1",
        42
      )
    ).rejects.toThrow("Stake winner event did not identify a winner");
  });

  it("rejects a stake winner whose player socket is missing", async () => {
    const { flow, stateUtils, eventUtils, userUtils } = createFixture();
    const providedPlayer = createSocket("game-1", "player-1");
    stateUtils.getGame.mockResolvedValue(createStakeBiddingGame());
    eventUtils.waitForEvent.mockResolvedValue({ winnerPlayerId: 2, finalBid: 310 });
    userUtils.getUserIdFromSocket.mockResolvedValue(1);

    await expect(
      stakeInternals(flow).completeBiddingPhase(
        createSocket("game-1", "showman"),
        [providedPlayer],
        "game-1",
        42
      )
    ).rejects.toThrow("winnerPlayerId=2");
  });

  it("returns the socket owned by the declared stake winner", async () => {
    const { flow, stateUtils, eventUtils, userUtils } = createFixture();
    const winnerSocket = createSocket("game-1", "player-7");
    const otherSocket = createSocket("game-1", "player-8");
    stateUtils.getGame.mockResolvedValue(createStakeBiddingGame());
    eventUtils.waitForEvent.mockResolvedValue({ winnerPlayerId: 7, finalBid: 310 });
    userUtils.getUserIdFromSocket.mockImplementation(async (socket) =>
      socket === winnerSocket ? 7 : 8
    );

    await expect(
      stakeInternals(flow).completeBiddingPhase(
        createSocket("game-1", "showman"),
        [otherSocket, winnerSocket],
        "game-1",
        42
      )
    ).resolves.toBe(winnerSocket);
  });
});

interface Fixture {
  readonly flow: SocketGameTestFlowUtils;
  readonly stateUtils: {
    readonly getGameState: jest.Mock<(gameId: string) => Promise<unknown>>;
    readonly getGame: jest.Mock<(gameId: string) => Promise<unknown>>;
  };
  readonly eventUtils: {
    readonly trackExpectation: <T>(promise: Promise<T>, description: string) => Promise<T>;
    readonly waitForSubmittedActions: jest.Mock<(...args: unknown[]) => Promise<void>>;
    readonly waitForActionsComplete: jest.Mock<(...args: unknown[]) => Promise<void>>;
    readonly waitForEvent: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
    readonly waitForEventMatching: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
    readonly waitForNoEvent: jest.Mock<(...args: unknown[]) => Promise<void>>;
    readonly emitAndWaitForEvent: jest.Mock<
      (_socket: unknown, _event: unknown, emit: () => void) => Promise<unknown>
    >;
  };
  readonly userUtils: {
    readonly getUserIdFromSocket: jest.Mock<(socket: GameClientSocket) => Promise<number>>;
  };
}

function createFixture(scenario?: GameScenario): Fixture {
  const stateUtils = {
    getGameState: jest.fn<(gameId: string) => Promise<unknown>>(),
    getGame: jest.fn<(gameId: string) => Promise<unknown>>()
  };
  const eventUtils = {
    trackExpectation: <T>(promise: Promise<T>, description: string): Promise<T> =>
      scenario ? scenario.trackExpectation(promise, description) : promise,
    waitForSubmittedActions: jest.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    waitForActionsComplete: jest.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    waitForEvent: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    waitForEventMatching: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    waitForNoEvent: jest.fn<(...args: unknown[]) => Promise<void>>(),
    emitAndWaitForEvent: jest.fn<
      (_socket: unknown, _event: unknown, emit: () => void) => Promise<unknown>
    >(async (_socket, _event, emit) => {
      emit();
      return [];
    })
  };
  const userUtils = {
    getUserIdFromSocket: jest.fn<(socket: GameClientSocket) => Promise<number>>()
  };
  const flow = new SocketGameTestFlowUtils(
    stateUtils as unknown as SocketGameTestStateUtils,
    eventUtils as unknown as SocketGameTestEventUtils,
    userUtils as unknown as SocketGameTestUserUtils
  );

  return { flow, stateUtils, eventUtils, userUtils };
}

function createRegularMediaFixture(hasFiles = true, scenario?: GameScenario) {
  const fixture = createFixture(scenario);
  const { flow, stateUtils, eventUtils, userUtils } = fixture;
  const showman = createSocket("game-1", "showman");
  const players = [createSocket("game-1", "player-11"), createSocket("game-1", "player-12")];
  const question = createQuestion(hasFiles ? createQuestionFiles() : []);
  stateUtils.getGame.mockResolvedValue({ gameState: { currentRound: {} } });
  stateUtils.getGameState.mockResolvedValue(mediaDownloadingState(question));
  userUtils.getUserIdFromSocket.mockImplementation(async (socket) =>
    socket === players[0] ? 11 : 12
  );
  mockQuestionPickExpectation(flow, SocketIOGameEvents.QUESTION_DATA, question);
  const events = createEventHarness(eventUtils);
  (showman.emit as jest.Mock).mockImplementation(() =>
    events.emit(SocketIOGameEvents.QUESTION_DATA, questionData(42, question.questionFiles ?? []))
  );
  players.forEach((player, index) => {
    (player.emit as jest.Mock).mockImplementation(() => {
      if (index === players.length - 1)
        stateUtils.getGameState.mockResolvedValue({
          questionState: QuestionState.SHOWING,
          timer: timer(GAME_QUESTION_ANSWER_TIME)
        });
      events.emit(
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        mediaStatus(index + 11, true, index === players.length - 1)
      );
    });
  });
  return { ...fixture, showman, players, events, question };
}

function createSocket(gameId: string, id = "socket"): GameClientSocket {
  return {
    id,
    gameId,
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  } as unknown as GameClientSocket;
}

function mediaStatus(
  playerId: number,
  mediaDownloaded: boolean,
  allPlayersReady: boolean
): MediaDownloadStatusBroadcastData {
  return {
    playerId,
    mediaDownloaded,
    allPlayersReady,
    timer: allPlayersReady ? timer(GAME_QUESTION_ANSWER_TIME) : null
  };
}

interface QuestionPickExpectation {
  readonly event: SocketIOGameEvents;
  readonly mediaHandshake: boolean;
  readonly question: PackageQuestionDTO;
}

function mockQuestionPickExpectation(
  flow: SocketGameTestFlowUtils,
  event: SocketIOGameEvents,
  question: PackageQuestionDTO
): void {
  jest
    .spyOn(
      flow as unknown as {
        _determineQuestionPickExpectation: (
          game: Game,
          questionId: number
        ) => Promise<QuestionPickExpectation>;
      },
      "_determineQuestionPickExpectation"
    )
    .mockResolvedValue({ event, question, mediaHandshake: true });
}

function createQuestion(questionFiles: readonly PackageQuestionFileDTO[]): PackageQuestionDTO {
  return {
    id: 42,
    type: PackageQuestionType.SIMPLE,
    subType: PackageQuestionSubType.SIMPLE,
    order: 0,
    price: 100,
    isHidden: false,
    text: "Question",
    answerText: "Answer",
    answerDelay: 200,
    showAnswerDuration: 200,
    questionFiles: [...questionFiles]
  };
}

function createQuestionFiles(): readonly PackageQuestionFileDTO[] {
  return [
    {
      file: {
        md5: "media.png",
        link: "https://media.example.test/media.png",
        type: PackageFileType.IMAGE
      },
      displayTime: null,
      order: 0
    }
  ];
}

function mediaDownloadingState(question: PackageQuestionDTO): Record<string, unknown> {
  return {
    questionState: QuestionState.MEDIA_DOWNLOADING,
    currentQuestion: question,
    timer: timer(MEDIA_DOWNLOAD_TIMEOUT)
  };
}

function questionData(
  questionId: number,
  questionFiles: readonly PackageQuestionFileDTO[]
): GameQuestionDataEventPayload {
  return {
    data: {
      id: questionId,
      questionFiles
    } as PackageQuestionDTO,
    timer: timer(MEDIA_DOWNLOAD_TIMEOUT)
  };
}

function timer(durationMs: number) {
  return {
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    durationMs,
    elapsedMs: 0,
    resumedAt: null
  };
}

interface PendingEventWait {
  readonly predicate: (data: unknown) => boolean;
  readonly resolve: (data: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly signal?: AbortSignal;
  readonly onAbort: () => void;
}

interface EventHarness {
  emit(event: SocketIOGameEvents, data: unknown): void;
}

function createEventHarness(eventUtils: Fixture["eventUtils"]): EventHarness {
  const eventWaits = new Map<string, PendingEventWait[]>();

  eventUtils.waitForEventMatching.mockImplementation((...args: unknown[]) => {
    const event = args[1] as string;
    const predicate = args[2] as (data: unknown) => boolean;
    const signal = args[4] as AbortSignal | undefined;

    return new Promise((resolve, reject) => {
      const remove = (pending: PendingEventWait): void => {
        eventWaits.set(
          event,
          (eventWaits.get(event) ?? []).filter((candidate) => candidate !== pending)
        );
        signal?.removeEventListener("abort", pending.onAbort);
      };
      const pending: PendingEventWait = {
        predicate,
        resolve: (data) => {
          remove(pending);
          resolve(data);
        },
        reject: (error) => {
          remove(pending);
          reject(error);
        },
        signal,
        onAbort: () => pending.reject(new Error(`wait aborted for ${event}`))
      };

      eventWaits.set(event, [...(eventWaits.get(event) ?? []), pending]);
      signal?.addEventListener("abort", pending.onAbort, { once: true });
    });
  });

  return {
    emit(event, data) {
      for (const pending of [...(eventWaits.get(event) ?? [])]) {
        try {
          if (pending.predicate(data)) {
            pending.resolve(data);
          }
        } catch (error) {
          pending.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  };
}

interface StakeFlowInternals {
  _handleStakeQuestionComplete(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    gameId: string,
    questionId: number,
    shouldAnswer: boolean,
    answerType: AnswerResultType,
    scoreResult: number
  ): Promise<void>;
  completeBiddingPhase(
    showmanSocket: GameClientSocket,
    playerSockets: GameClientSocket[],
    gameId: string,
    questionId: number
  ): Promise<GameClientSocket>;
  _submitAnswerResultWithQuestionComplete(
    showmanSocket: GameClientSocket,
    answeringPlayerSocket: GameClientSocket,
    answerType: AnswerResultType,
    scoreResult: number
  ): Promise<void>;
}

function stakeInternals(flow: SocketGameTestFlowUtils): StakeFlowInternals {
  return flow as unknown as StakeFlowInternals;
}

function createGameWithPlayers(players: readonly unknown[]): Game {
  return { players } as unknown as Game;
}

function playerState(id: number, role: PlayerRole, gameStatus: PlayerGameStatus): unknown {
  return { meta: { id }, role, gameStatus };
}

function createStakeBiddingGame(): Game {
  return {
    gameState: {
      stakeQuestionData: {
        biddingOrder: []
      }
    }
  } as unknown as Game;
}
