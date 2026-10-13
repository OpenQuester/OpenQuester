import { describe, expect, it } from "vitest";

import {
  buildContentPlan,
  nextChangeAt,
  positionAt,
  textDuration,
  timerElapsed,
} from "./contentPlan";
import { choosing, question, timer } from "./fixtures";
import type { ContentPlan, QuestionFile, ServerEvent } from "./protocol";
import { reduce, type GameSession } from "./reducer";

const file = (
  order: number,
  type: "image" | "audio" | "video",
  extra: Partial<QuestionFile> = {},
) =>
  ({
    order,
    displayTime: null,
    file: { md5: `m${order}`, type, link: `https://files/m${order}` },
    ...extra,
  }) satisfies QuestionFile;

/** text → video → video, as the server would time it (12 s and 8 s clips). */
const textVideoVideo: ContentPlan = {
  totalMs: 22_000,
  steps: [
    {
      startMs: 0,
      durationMs: 2_000,
      items: [{ kind: "text", order: 0, placement: "screen", durationMs: 2_000 }],
    },
    {
      startMs: 2_000,
      durationMs: 12_000,
      items: [{ kind: "file", order: 1, placement: "screen", durationMs: 12_000 }],
    },
    {
      startMs: 14_000,
      durationMs: 8_000,
      items: [{ kind: "file", order: 2, placement: "screen", durationMs: 8_000 }],
    },
  ],
};

const run = (s: GameSession, ...events: ServerEvent[]) => events.reduce(reduce, s);

describe("content timeline", () => {
  it("shows one step at a time", () => {
    expect(positionAt(textVideoVideo, 500).screen.map((i) => i.kind)).toEqual(["text"]);
    expect(positionAt(textVideoVideo, 2_000).screen.map((i) => i.order)).toEqual([1]);
    expect(positionAt(textVideoVideo, 15_000).screen.map((i) => i.order)).toEqual([2]);
    const end = positionAt(textVideoVideo, 30_000);
    expect(end.done).toBe(true);
    expect(end.screen.map((i) => i.order)).toEqual([2]);
  });

  it("keeps the previous screen during a sound-only step and plays the sound", () => {
    const plan = buildContentPlan({
      files: [file(0, "image"), file(1, "audio", { placement: "background", displayTime: 9_000 })],
    })!;
    const pos = positionAt(plan, 6_000);
    expect(pos.screen.map((i) => i.order)).toEqual([0]);
    expect(pos.background.map((b) => b.item.order)).toEqual([1]);
    expect(positionAt(plan, 15_000).background).toEqual([]);
  });

  it("wakes up at the next step boundary", () => {
    expect(nextChangeAt(textVideoVideo, 500)).toBe(2_000);
    expect(nextChangeAt(textVideoVideo, 14_500)).toBe(22_000);
    expect(nextChangeAt(textVideoVideo, 22_000)).toBeNull();
  });

  it("builds the same steps as the server without a plan from it", () => {
    const plan = buildContentPlan({
      text: "Name the film",
      textOrder: 0,
      files: [file(1, "video"), file(2, "video", { displayTime: 8_000 })],
    })!;
    expect(plan.steps.map((s) => s.items.map((i) => `${i.kind}:${i.order}`))).toEqual([
      ["text:0"],
      ["file:1"],
      ["file:2"],
    ]);
    expect(plan.steps.map((s) => s.durationMs)).toEqual([
      textDuration("Name the film"),
      20_000,
      8_000,
    ]);
    // A caption text (no textOrder) is not a step.
    expect(buildContentPlan({ text: "Who?", files: [file(0, "image")] })!.steps).toHaveLength(1);
    expect(buildContentPlan({ text: "Only text" })).toBeNull();
  });

  it("reads elapsed time off the server timer", () => {
    const now = Date.parse("2026-10-14T10:00:10.000Z");
    const t = {
      startedAt: "2026-10-14T10:00:00.000Z",
      durationMs: 40_000,
      elapsedMs: 3_000,
      resumedAt: null,
    };
    expect(timerElapsed(t, false, now)).toBe(13_000);
    expect(timerElapsed(t, true, now)).toBe(3_000);
  });
});

describe("reducer: content clock", () => {
  const picked = (plan?: ContentPlan | null) =>
    run(
      choosing(),
      { type: "question-data", payload: { data: question(100), timer: timer(30_000) } },
      {
        type: "media-download-status",
        payload: {
          playerId: -1,
          mediaDownloaded: true,
          allPlayersReady: true,
          timer: timer(42_500),
          ...(plan !== undefined ? { contentPlan: plan } : {}),
        },
      },
    );

  it("has no timeline while media preloads, then runs the server's plan", () => {
    const pre = reduce(choosing(), {
      type: "question-data",
      payload: { data: question(100), timer: timer(30_000) },
    });
    expect(pre.content).toBeNull();
    const s = picked(textVideoVideo);
    expect(s.content).toMatchObject({ kind: "question", plan: textVideoVideo, frozenAtMs: null });
    expect(s.content?.timer?.durationMs).toBe(42_500);
  });

  it("has no timeline when the server says there is nothing to sequence", () => {
    expect(picked(null).content).toBeNull();
  });

  it("freezes while someone answers and resumes on the restored timer", () => {
    let s = picked(textVideoVideo);
    s = reduce(s, { type: "question-answer", payload: { userId: 2, timer: timer(60_000) } });
    expect(s.content?.frozenAtMs).not.toBeNull();
    const restored = { ...timer(42_500), elapsedMs: 5_000 };
    s = reduce(s, {
      type: "answer-result",
      payload: {
        answerResult: { player: 2, result: -100, score: -100, answerType: "wrong" },
        timer: restored,
      },
    });
    expect(s.content).toMatchObject({ frozenAtMs: null, timer: restored });
  });

  it("plays the answer files on reveal and clears on the board", () => {
    let s = picked(textVideoVideo);
    const answerContentPlan: ContentPlan = {
      totalMs: 5_000,
      steps: [
        {
          startMs: 0,
          durationMs: 5_000,
          items: [{ kind: "file", order: 0, placement: "screen", durationMs: 5_000 }],
        },
      ],
    };
    s = reduce(s, {
      type: "question-finish",
      payload: {
        answerFiles: [file(0, "image")],
        answerText: "Kyiv",
        nextTurnPlayerId: null,
        answerContentPlan,
      },
    });
    expect(s.content).toMatchObject({ kind: "answer", plan: answerContentPlan });
    s = reduce(s, { type: "answer-show-end", payload: {} });
    expect(s.content).toBeNull();
  });
});
