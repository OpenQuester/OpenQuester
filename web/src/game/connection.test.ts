import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameConnection } from "./connection";
import { ALICE, BOB, player, question, snapshot } from "./fixtures";
import type { FileType, QuestionFile } from "./protocol";

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
    media.push(this);
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

function file(type: FileType, md5 = type): QuestionFile {
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

describe("question media readiness", () => {
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
