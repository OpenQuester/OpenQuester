import { createRoot } from "react-dom/client";
import { mountGame, sent } from "./round-transition.fixture";
import { ALICE, choosing, question, round, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { PlaytestSession } from "../src/features/package-editor/playtest/PlaytestSession";
import { initialPreview } from "../src/features/package-editor/playtest/previewModel";
import type { ContentPlan, PlayerRole } from "../src/game/protocol";
import { timerElapsed } from "../src/game/contentPlan";

export { sent };
export function pause(paused: boolean) {
  const current = useGameStore.getState().session!;
  const clock = current.state.timer!;
  const elapsedMs = timerElapsed(clock, current.state.isPaused);
  useGameStore.getState().dispatch({
    type: paused ? "game-pause" : "game-unpause",
    payload: { timer: { ...timer(clock.durationMs), elapsedMs } },
  });
}
export function mount(
  mode: "question" | "answer" | "final" | "playtest" | "audio" | "mixed" | "text" | "choice",
  role: PlayerRole = "player",
) {
  const q = question(100, {
    text: "Middle clue",
    textOrder: 1,
    questionFiles: [0, 2].map((order) => ({
      order,
      displayTime: order === 0 ? 8000 : 1000,
      file: { type: "video" as const, md5: "same-clip", link: "/e2e/fixtures/clip.webm" },
    })),
  });
  if (mode === "playtest") {
    document.getElementById("root")!.hidden = true;
    useSettings.getState().update({ language: "en", sound: false, volume: 0 });
    const container = document.createElement("div");
    document.body.append(container);
    const initial = initialPreview(false, "Replay", q, {
      showman: "Host",
      players: ["One", "Two", "Three"],
      spectator: "Watcher",
      round: "Round",
      final: "Final",
      theme: "Replay",
    });
    createRoot(container).render(
      <PlaytestSession
        initial={initial}
        question={q}
        credits={{ authors: [], sources: [] }}
        legacy={false}
        onRestart={() => {}}
      />,
    );
    return;
  }
  mountGame(0);
  useSettings.getState().update({ pins: {}, volume: 0 });
  sent.length = 0;
  const s = choosing();
  s.players = s.players.map((p) =>
    p.meta.id === ALICE
      ? { ...p, role }
      : role === "showman" && p.role === "showman"
        ? { ...p, role: "spectator" }
        : p,
  );
  const plan: ContentPlan = {
    totalMs: 9400,
    steps: [
      {
        startMs: 0,
        durationMs: 8000,
        items: [{ kind: "file", order: 0, durationMs: 8000, placement: "screen" }],
      },
      {
        startMs: 8000,
        durationMs: 400,
        items: [{ kind: "text", order: 1, durationMs: 400, placement: "screen" }],
      },
      {
        startMs: 8400,
        durationMs: 1000,
        items: [{ kind: "file", order: 2, durationMs: 1000, placement: "screen" }],
      },
    ],
  };
  if (mode === "mixed" || mode === "choice") {
    q.text = "A long question beside the video. ".repeat(30);
    q.textOrder = null;
    q.questionFiles = [{ ...q.questionFiles![0]!, displayTime: 4000 }];
    plan.totalMs = 4000;
    plan.steps = [
      {
        startMs: 0,
        durationMs: 4000,
        items: [{ kind: "file", order: 0, durationMs: 4000, placement: "screen" }],
      },
    ];
  }
  if (mode === "choice") {
    q.type = "choice";
    q.answers = [0, 1, 2, 3].map((order) => ({ order, text: `Option ${order + 1}`, file: null }));
  }
  if (mode === "text") {
    q.text = null;
    q.textOrder = null;
    q.questionFiles = [];
    q.textItems = [0, 1].map((order) => ({ order, text: `Clue ${order + 1}` }));
    plan.totalMs = 2000;
    plan.steps = [0, 1].map((order) => ({
      startMs: order * 1000,
      durationMs: 1000,
      items: [{ kind: "text", order, durationMs: 1000, placement: "screen" }],
    }));
  }
  if (mode === "audio") {
    q.text = "Audio";
    q.textOrder = null;
    q.questionFiles = [
      {
        order: 0,
        displayTime: 1000,
        file: { type: "audio", md5: "clip", link: "/e2e/fixtures/clip.webm" },
      },
    ];
    plan.totalMs = 1000;
    plan.steps = [
      {
        startMs: 0,
        durationMs: 1000,
        items: [{ kind: "file", order: 0, durationMs: 1000, placement: "screen" }],
      },
    ];
  }
  s.state = {
    ...s.state,
    currentQuestion: q,
    questionState:
      mode === "answer" ? "showing_answer" : mode === "final" ? "answering" : "showing",
    timer: timer(60000),
    questionContentPlan: plan,
  };
  s.content = {
    kind: mode === "answer" ? "answer" : "question",
    plan,
    timer: s.state.timer!,
    frozenAtMs: null,
  };
  if (mode === "answer") {
    // Answer timelines contain media; use a still image for the middle step.
    s.content.plan = {
      ...plan,
      steps: plan.steps.map((step, i) =>
        i === 1
          ? { ...step, items: [{ kind: "file", order: 1, durationMs: 400, placement: "screen" }] }
          : step,
      ),
    };
    s.state.answerShowData = {
      answerText: "Answer",
      nextTurnPlayerId: null,
      answerFiles: [
        ...q.questionFiles!,
        {
          order: 1,
          displayTime: 400,
          file: {
            type: "image",
            md5: "image",
            link: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='gold'/%3E%3C/svg%3E",
          },
        },
      ],
    };
  }
  if (mode === "final") {
    s.state.currentRound = round("final");
    s.state.finalRoundData = {
      phase: "answering",
      bids: { [ALICE]: 100 },
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Replay", question: q, contentPlan: plan },
    };
  }
  useGameStore.getState().setSession(s);
}
