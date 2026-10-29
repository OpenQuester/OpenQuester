import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUZZ_PENDING_TIMEOUT_MS, GameConnection } from "./connection";
import { ALICE, BOB, player, question, round, snapshot, timer } from "./fixtures";
import type { FileType, QuestionFile } from "./protocol";
import { useGameStore } from "./store";

const { socket, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  return {
    listeners,
    socket: {
      connected: true,
      on: vi.fn((name: string, listener: (payload: unknown) => void) =>
        listeners.set(name, listener),
      ),
      emit: vi.fn(),
      removeAllListeners: vi.fn(() => listeners.clear()),
      disconnect: vi.fn(),
    },
  };
});

vi.mock("socket.io-client", () => ({ io: () => socket }));

let connection: GameConnection;
let images: HTMLImageElement[];
let media: HTMLMediaElement[];

beforeEach(() => {
  vi.useFakeTimers();
  images = [];
  media = [];
  socket.emit.mockClear();
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      const image = document.createElement("img");
      image.decode = vi.fn().mockResolvedValue(undefined);
      images.push(image);
      return image;
    }),
  );
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (this.hasAttribute("src")) media.push(this);
  });
  connection = new GameConnection("ABCD", ALICE, { role: "player" });
  connection.connect();
});

afterEach(() => {
  connection.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function file(type: FileType, md5: string = type): QuestionFile {
  return { order: 0, displayTime: null, file: { type, md5, link: `https://media.example/${md5}` } };
}

function receiveQuestion(files: QuestionFile[]) {
  listeners.get("game-data")?.(
    snapshot({
      questionState: "media_downloading",
      currentQuestion: question(100, { questionFiles: files }),
    }),
  );
}

describe("answer submission retries", () => {
  it.each(["error", "timeout"])(
    "clears a pending answer after %s and permits retry",
    async (failure) => {
      listeners.get("game-data")?.(
        snapshot({
          questionState: "answering",
          answeringPlayer: ALICE,
          currentQuestion: question(),
        }),
      );
      connection.emit("answer-submitted", { answerText: "2" });
      expect(useGameStore.getState().pending?.action).toBe("answer-submitted");
      if (failure === "error") listeners.get("error")?.({ message: "Submission failed" });
      else await vi.advanceTimersByTimeAsync(10_000);
      expect(useGameStore.getState().pending).toBeNull();
      expect(useGameStore.getState().session?.submittedAnswer).toBeNull();
      connection.emit("answer-submitted", { answerText: "2" });
      expect(socket.emit).toHaveBeenCalledTimes(2);
      expect(socket.emit).toHaveBeenLastCalledWith("answer-submitted", { answerText: "2" });
      listeners.get("answer-submitted")?.({ answerText: "2" });
      expect(useGameStore.getState().pending).toBeNull();
      expect(useGameStore.getState().session?.submittedAnswer).toBe("2");
    },
  );
});

describe("question media readiness", () => {
  it.each(["regular", "final"])(
    "does not acknowledge %s media with a missing URL",
    async (kind) => {
      const missing = { ...file("image"), file: { ...file("image").file, link: null } };
      if (kind === "regular") receiveQuestion([missing]);
      else {
        const q = question(100, { questionFiles: [missing] });
        listeners.get("game-data")?.(
          snapshot({
            currentRound: round("final"),
            questionState: "media_downloading",
            finalRoundData: {
              phase: "answering",
              bids: {},
              answers: [],
              turnOrder: [ALICE],
              eliminatedThemes: [],
              questionData: {
                themeId: 10,
                themeName: "Final",
                question: q,
                mediaPreparationId: "missing",
              },
            },
          }),
        );
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(socket.emit).not.toHaveBeenCalled();
    },
  );
  it("preloads a final question and acknowledges only its current preparation", async () => {
    listeners.get("game-data")?.(
      snapshot({
        currentRound: round("final"),
        questionState: "bidding",
        finalRoundData: {
          phase: "bidding",
          bids: {},
          answers: [],
          turnOrder: [ALICE],
          eliminatedThemes: [],
        },
      }),
    );
    const data = (id: string) => ({
      questionData: {
        themeId: 10,
        themeName: "Final",
        question: question(100, { questionFiles: [file("image", id)] }),
        mediaPreparationId: id,
      },
      timer: timer(30_000),
    });
    listeners.get("final-question-data")?.(data("old"));
    const old = images[0]!;
    listeners.get("final-question-data")?.(data("new"));
    old.dispatchEvent(new Event("load"));
    images[1]!.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("media-downloaded", {
      mediaPreparationId: "new",
    });
  });

  it("preloads a final preparation received in a rejoin snapshot", async () => {
    const q = question(100, { questionFiles: [file("image")] });
    listeners.get("game-data")?.(
      snapshot({
        currentRound: round("final"),
        questionState: "media_downloading",
        currentQuestion: null,
        finalRoundData: {
          phase: "answering",
          bids: {},
          answers: [],
          turnOrder: [ALICE],
          eliminatedThemes: [],
          questionData: {
            themeId: 10,
            themeName: "Final",
            question: q,
            mediaPreparationId: "rejoin",
          },
        },
      }),
    );
    images[0]!.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("media-downloaded", {
      mediaPreparationId: "rejoin",
    });
  });

  it.each(["close", "timeout", "replace", "disconnect"])(
    "releases stalled media on %s without acknowledging it",
    async (ending) => {
      receiveQuestion([file("image"), file("video")]);
      const image = images[0]!,
        video = media[0]!;
      if (ending === "close") connection.close();
      else if (ending === "disconnect") listeners.get("disconnect")?.("transport close");
      else if (ending === "replace") receiveQuestion([file("image", "next-image")]);
      else await vi.advanceTimersByTimeAsync(45_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(image.hasAttribute("src")).toBe(false);
      expect(video.hasAttribute("src")).toBe(false);
      expect(image.onload).toBeNull();
      expect(video.oncanplaythrough).toBeNull();
      image.dispatchEvent(new Event("load"));
      video.dispatchEvent(new Event("canplaythrough"));
      await vi.advanceTimersByTimeAsync(0);
      expect(socket.emit).not.toHaveBeenCalled();
    },
  );
  it.each(["image load", "image decode", "audio", "video", "stalled"])(
    "does not acknowledge a failed %s before or after the local timeout",
    async (failure) => {
      receiveQuestion([file(failure === "audio" || failure === "video" ? failure : "image")]);
      if (failure === "image decode") {
        vi.mocked(images[0]!.decode).mockRejectedValueOnce(new Error("cannot decode"));
        images[0]!.dispatchEvent(new Event("load"));
      } else if (failure === "image load") {
        images[0]!.dispatchEvent(new Event("error"));
      } else if (failure === "audio" || failure === "video") {
        media[0]!.dispatchEvent(new Event("error"));
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(socket.emit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(45_000);
      expect(socket.emit).not.toHaveBeenCalled();
    },
  );

  it("waits for every successful load and image decode, then reports real media lengths", async () => {
    receiveQuestion([file("image"), file("audio"), file("video")]);
    let finishDecode!: () => void;
    vi.mocked(images[0]!.decode).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDecode = resolve;
      }),
    );
    images[0]!.dispatchEvent(new Event("load"));
    for (const [index, element] of media.entries()) {
      Object.defineProperty(element, "duration", { value: index + 2.5 });
      element.dispatchEvent(new Event("canplaythrough"));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.emit).not.toHaveBeenCalled();
    finishDecode();
    await vi.advanceTimersByTimeAsync(0);

    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("media-downloaded", {
      mediaDurations: [
        { md5: "audio", durationMs: 2500 },
        { md5: "video", durationMs: 3500 },
      ],
    });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(socket.emit).toHaveBeenCalledOnce();
  });

  it("immediately acknowledges a question with no media", async () => {
    receiveQuestion([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("media-downloaded");
  });
});

describe("spectator seat selection", () => {
  it("moves to the clicked seat only after this spectator becomes a player", () => {
    const spectator = player(ALICE, "spectator");
    const otherPlayer = player(BOB, "player");
    listeners.get("game-data")?.(snapshot({}, [spectator, otherPlayer]));

    connection.takeSeat(3);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("player-role-change", {
      playerId: ALICE,
      newRole: "player",
    });
    listeners.get("player-role-change")?.({
      playerId: BOB,
      newRole: "player",
      players: [spectator, otherPlayer],
    });
    expect(socket.emit).toHaveBeenCalledOnce();

    const roleChanged = {
      playerId: ALICE,
      newRole: "player",
      players: [player(ALICE, "player", { slot: 0 }), otherPlayer],
    };
    listeners.get("player-role-change")?.(roleChanged);
    expect(socket.emit).toHaveBeenLastCalledWith("player-slot-change", { targetSlot: 3 });
    expect(socket.emit).toHaveBeenCalledTimes(2);
    listeners.get("player-role-change")?.(roleChanged);
    expect(socket.emit).toHaveBeenCalledTimes(2);
  });

  it("keeps the server-assigned seat when it is already the requested one", () => {
    listeners.get("game-data")?.(snapshot({}, [player(ALICE, "spectator")]));
    connection.takeSeat(0);
    listeners.get("player-role-change")?.({
      playerId: ALICE,
      newRole: "player",
      players: [player(ALICE, "player", { slot: 0 })],
    });
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("player-role-change", {
      playerId: ALICE,
      newRole: "player",
    });
  });
});

describe("buzz lock during the random draw", () => {
  beforeEach(() => {
    listeners.get("game-data")?.(
      snapshot({ questionState: "showing", currentQuestion: question(100) }),
    );
  });

  it("stays locked past the normal wait until the draw names who answers", async () => {
    connection.emit("question-answer");

    // The server sends nothing for a press that joined the draw
    await vi.advanceTimersByTimeAsync(5_000);
    expect(useGameStore.getState().pending?.action).toBe("question-answer");

    listeners.get("question-answer")?.({
      userId: BOB,
      timer: { durationMs: 20_500, elapsedMs: 0 },
    });
    expect(useGameStore.getState().pending).toBeNull();
  });

  it("unlocks after the safety timeout when no result ever comes", async () => {
    connection.emit("question-answer");

    await vi.advanceTimersByTimeAsync(BUZZ_PENDING_TIMEOUT_MS);

    expect(useGameStore.getState().pending).toBeNull();
  });
});
