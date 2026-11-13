import { expect, it } from "vitest";
import fixture from "@/features/upload/fixtures/siq/script-two-asks.xml?raw";
import { parseSiq } from "@/features/upload/siq";
import {
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  type DraftChoiceOption,
} from "../packageDraft";
import { checkQuestion } from "../validatePackage";
import { finalPreviewRoundPrices, initialPreview, previewQuestion } from "./previewModel";
import { PreviewRuntime } from "./previewRuntime";
import { canBuzz } from "@/game/selectors";
import type { QuestionScriptStep } from "@/game/questionScript";

const direct: QuestionScriptStep = { op: "askAnswer", mode: "direct", durationMs: 15000 };
const numeric: QuestionScriptStep = { op: "setAnswerType", answerType: "number" };

function scriptedPreview(
  steps: QuestionScriptStep[],
  final = false,
  setup: { solo?: boolean; options?: DraftChoiceOption[] } = {},
) {
  const options = setup.options ?? [
    { id: "a", text: "First", file: null, scriptOrder: 0 },
    { id: "b", text: "Second", file: null, scriptOrder: 1 },
  ];
  const draft = newQuestion(100, {
    ...(final ? { realPrice: 100 } : {}),
    answerText: "42",
    options,
    script: { version: 1, steps },
  });
  const question = previewQuestion(draft, final, new Map());
  const runtime = new PreviewRuntime(
    initialPreview(
      final,
      "Cell",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    { ...question, answerNumber: 42 },
  );
  if (setup.solo) runtime.session.players.splice(2, 2);
  if (final) {
    runtime.command({ type: "theme-eliminate", payload: { themeId: 10 } }, 1);
    runtime.command({ type: "theme-eliminate", payload: { themeId: 11 } }, 1);
  } else {
    runtime.pick();
  }
  return runtime;
}

it("skips an empty transfer in preview and retains the ordinary picker fallback", () => {
  const skipped = scriptedPreview(
    [{ op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" }, direct, { op: "accept" }],
    false,
    { solo: true },
  );
  expect(skipped.session.state.questionState).toBe("showing_answer");
  expect(skipped.session.state.answeringPlayer).toBeNull();
  expect(skipped.session.players.find((player) => player.meta.id === 2)?.score).toBe(1000);
  skipped.dispose();
  const fallback = scriptedPreview([direct], false, { solo: true });
  expect(fallback.session.state.answeringPlayer).toBe(2);
  fallback.dispose();
});

it("requires the active select option and its canonical media placeholder", () => {
  const game = scriptedPreview(
    [
      { op: "setAnswerType", answerType: "select", optionOrders: [2, 1], correctChoiceOrder: 1 },
      { op: "setAnswerer", mode: "current" },
      direct,
    ],
    false,
    {
      options: [
        { id: "a", text: "#1", file: null, scriptOrder: 0 },
        { id: "b", text: "", file: { md5: "image", type: "image" }, scriptOrder: 1 },
        { id: "c", text: "1", file: null, scriptOrder: 2 },
      ],
    },
  );
  for (const payload of [
    { answerText: "#1" },
    { answerText: "#1", choiceOrder: 0 },
    { answerText: "#1", choiceOrder: 1.5 },
    { answerText: "1", choiceOrder: 1 },
  ]) {
    game.command({ type: "answer-submitted", payload }, 2);
    expect(game.session.state.scriptView?.waitingFor).toBe("answer");
    expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  }
  game.command({ type: "answer-submitted", payload: { answerText: "#1", choiceOrder: 1 } }, 2);
  expect(game.session.state.questionState).toBe("showing_answer");
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1100);
  game.dispose();
});

it("skips typed input for zero, advances a direct ask and undoes the skip once at reveal", () => {
  const game = scriptedPreview([numeric, direct, direct]);
  const skip = {
    type: "answer-result",
    payload: { answerType: "skip", scoreResult: -100 },
  } as const;
  const step = game.session.state.scriptView!.programCounter;
  for (const answerType of ["correct", "wrong"] as const) {
    game.command({ type: "answer-result", payload: { answerType, scoreResult: 0 } }, 1);
  }
  game.command(skip, 3);
  expect(game.session.state.scriptView?.programCounter).toBe(step);
  game.command(skip, 1);
  expect(game.session.state.scriptView?.programCounter).toBe(step + 1);
  expect(game.session.lastResult).toMatchObject({ player: 2, answerType: "skip", result: 0 });
  game.command(skip, 1);
  expect(game.session.state.questionState).toBe("showing_answer");
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  game.command({ type: "answer-result-undo", payload: undefined }, 1);
  expect(game.session.state.answeredPlayers).toHaveLength(0);
  expect(game.session.lastResult).toBeNull();
  expect(game.session.state.questionState).toBe("showing_answer");
  const afterUndo = game.session;
  game.command({ type: "answer-result-undo", payload: undefined }, 1);
  expect(game.session).toBe(afterUndo);
  game.dispose();
});

it("reopens a scripted button ask after a neutral skip and lets the player buzz again after undo", () => {
  const game = scriptedPreview(
    [
      { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
      { op: "askAnswer", mode: "button", durationMs: 15000 },
    ],
    true,
  );
  const buzz = { type: "question-answer", payload: undefined } as const;
  const selection = {
    type: "answer-submitted",
    payload: { answerText: "Second", choiceOrder: 1 },
  } as const;
  game.command(buzz, 2);
  game.command(selection, 2);
  game.command({ type: "answer-result", payload: { answerType: "skip", scoreResult: 0 } }, 1);
  expect(game.session.state.questionState).toBe("showing");
  expect(game.session.state.answeredPlayers).toMatchObject([
    { player: 2, answerType: "skip", result: 0, choiceOrder: 1 },
  ]);
  expect(game.session.state.timer?.durationMs).toBeLessThanOrEqual(15_000);
  game.command(buzz, 2);
  expect(game.session.state.answeringPlayer).toBeNull();
  game.command({ type: "answer-result-undo", payload: undefined }, 1);
  game.command(buzz, 2);
  expect(game.session.state.answeringPlayer).toBe(2);
  game.command(selection, 2);
  game.command({ type: "answer-result", payload: { answerType: "skip", scoreResult: 0 } }, 1);
  game.command(buzz, 3);
  game.command(selection, 3);
  game.command({ type: "answer-result", payload: { answerType: "correct", scoreResult: 100 } }, 1);
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  expect(game.session.players.find((p) => p.meta.id === 3)?.score).toBe(1100);
  game.dispose();
});

it("reopens the same button ask and rejected option after undo", () => {
  const game = scriptedPreview([
    { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
    { op: "askAnswer", mode: "button", durationMs: 15000 },
  ]);
  const buzz = { type: "question-answer", payload: undefined } as const;
  const undo = { type: "answer-result-undo", payload: undefined } as const;
  const wrong = {
    type: "answer-submitted",
    payload: { answerText: "First", choiceOrder: 0 },
  } as const;
  game.command(buzz, 2);
  game.command(wrong, 2);
  expect(game.session.state.answeredPlayers).toMatchObject([{ player: 2, choiceOrder: 0 }]);
  expect(canBuzz(game.session, 2).ok).toBe(false);
  game.command(undo, 1);
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  expect(canBuzz(game.session, 2).ok).toBe(true);
  game.command(buzz, 2);
  expect(game.session.state.answeringPlayer).toBe(2);
  game.command(wrong, 2);
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(900);
  game.command(buzz, 3);
  game.command(wrong, 3);
  expect(game.session.state.answeringPlayer).toBe(3);
  game.dispose();
});

it("accepts identical group choices and marks only the missing answer as terminal", () => {
  const game = scriptedPreview(
    [
      { op: "setAnswerer", mode: "all" },
      { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
      direct,
    ],
    true,
  );
  for (const sender of [2, 3]) {
    game.command(
      {
        type: "all-play-answer",
        payload: { answerText: "First", choiceOrder: 0 },
      },
      sender,
    );
  }
  game.timeout();
  expect(game.session.state.questionState).toBe("reviewing");
  expect(game.session.state.allPlay?.entries).toMatchObject([
    { playerId: 2, choiceOrder: 0, submitted: true, isCorrect: null },
    { playerId: 3, choiceOrder: 0, submitted: true, isCorrect: null },
    { playerId: 4, submitted: true, isCorrect: false },
  ]);
  game.command({ type: "all-play-review", payload: { playerId: 4, isCorrect: true } }, 1);
  expect(game.session.state.allPlay?.entries[2]?.isCorrect).toBe(false);
  game.dispose();
});

it("keeps a button pass neutral and requires unskip before the same player may buzz", () => {
  const game = scriptedPreview([numeric, { op: "askAnswer", mode: "button", durationMs: 15000 }]);
  game.command({ type: "question-skip", payload: undefined }, 2);
  expect(game.session.state.skippedPlayers).toEqual([2]);
  game.command({ type: "question-answer", payload: undefined }, 2);
  expect(game.session.state.questionState).toBe("showing");
  game.command({ type: "question-unskip", payload: undefined }, 2);
  game.command({ type: "question-answer", payload: undefined }, 2);
  expect(game.session.state.answeringPlayer).toBe(2);
  game.command({ type: "answer-submitted", payload: { answerText: "42" } }, 2);
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1100);
  game.dispose();
});

it("does not offer the buzzer to an already passed player after a wrong answer", () => {
  const game = scriptedPreview([numeric, { op: "askAnswer", mode: "button", durationMs: 15000 }]);
  game.command({ type: "question-skip", payload: undefined }, 3);
  game.command({ type: "question-skip", payload: undefined }, 4);
  game.command({ type: "question-answer", payload: undefined }, 2);
  game.command({ type: "answer-submitted", payload: { answerText: "7" } }, 2);
  expect(game.session.state.questionState).toBe("showing_answer");
  expect(game.session.players.find((p) => p.meta.id === 3)?.score).toBe(1000);
  game.dispose();
});

it.each(["all submitted", "timeout"])("preserves submitted stakes when bidding ends: %s", (end) => {
  const game = scriptedPreview([
    { op: "setAnswerer", mode: "stake", select: "allPossible", stakeVisibility: "hidden" },
    numeric,
    direct,
  ]);
  game.command({ type: "all-play-stake", payload: { amount: 0 } }, 2);
  game.command({ type: "all-play-stake", payload: { amount: 150 } }, 2);
  game.command({ type: "all-play-stake", payload: { amount: 175 } }, 2);
  expect(game.session.state.questionState).toBe("bidding");
  if (end === "timeout") {
    game.timeout();
  } else {
    game.command({ type: "all-play-stake", payload: { amount: 200 } }, 3);
    game.command({ type: "all-play-stake", payload: { amount: 300 } }, 4);
  }
  const stakes = end === "timeout" ? [150, 100, 100] : [150, 200, 300];
  expect(game.session.state.allPlay?.mode).toBe("stake");
  expect(game.session.state.allPlay?.entries.map((entry) => entry.stake)).toEqual(stakes);
  game.setPerspective(2);
  expect(game.store.getState().session?.state.scriptView?.scoreEstimate).toEqual({
    win: 150,
    lose: -150,
  });
  game.setPerspective(5);
  expect(game.store.getState().session?.state.scriptView?.scoreEstimate).toBeUndefined();
  for (const sender of [2, 3, 4]) {
    game.command(
      { type: "all-play-answer", payload: { answerText: sender === 2 ? "42" : "7" } },
      sender,
    );
  }
  expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1150);
  game.dispose();
});

it("lets the actual picker choose the group price after a transfer", () => {
  const game = scriptedPreview([
    { op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" },
    { op: "setAnswerer", mode: "all" },
    { op: "setPrice", mode: "select", range: { min: 100, max: 300, step: 200 } },
    direct,
  ]);
  game.command({ type: "secret-question-transfer", payload: { targetPlayerId: 2 } }, 2);
  expect(game.session.state.scriptView?.waitingFor).toBe("answerer");
  game.command({ type: "secret-question-transfer", payload: { targetPlayerId: 3 } }, 2);
  expect(game.session.state.scriptView).toMatchObject({ waitingFor: "price", actorId: 3 });
  game.setPerspective(2);
  expect(game.store.getState().session?.state.scriptView?.priceRange).toBeUndefined();
  game.setPerspective(3);
  expect(game.store.getState().session?.state.scriptView?.priceRange).toEqual({
    min: 100,
    max: 300,
    step: 200,
  });
  for (const amount of [200, 301, 100.5]) {
    game.command({ type: "secret-question-price", payload: { price: amount } }, 3);
    expect(game.session.state.scriptView?.waitingFor).toBe("price");
  }
  game.command({ type: "secret-question-price", payload: { price: 300 } }, 3);
  expect(game.session.state.currentQuestion).toMatchObject({ price: 100, realPrice: 300 });
  game.dispose();
});

it("uses the minimum opening bid on timeout and passes subsequent bidders", () => {
  const game = scriptedPreview([
    { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
    numeric,
    direct,
  ]);
  game.command({ type: "stake-bid-submit", payload: { bidType: "pass", bidAmount: null } }, 2);
  expect(game.session.state.scriptView?.actorId).toBe(2);
  game.timeout();
  expect(game.session.state.stakeQuestionData?.highestBid).toBe(100);
  expect(game.session.state.scriptView?.actorId).toBe(3);
  game.command({ type: "stake-bid-submit", payload: { bidType: "normal", bidAmount: 150 } }, 3);
  expect(game.session.state.scriptView?.actorId).toBe(4);
  game.timeout();
  game.timeout();
  expect(game.session.state.stakeQuestionData).toMatchObject({
    biddingPhase: false,
    winnerPlayerId: 3,
    highestBid: 150,
  });
  game.setPerspective(3);
  expect(game.store.getState().session?.state.scriptView?.scoreEstimate).toEqual({
    win: 150,
    lose: -150,
  });
  game.command({ type: "answer-submitted", payload: { answerText: "42" } }, 3);
  expect(game.session.players.find((p) => p.meta.id === 3)?.score).toBe(1150);
  game.dispose();
});

it.each(["any", "exceptCurrent"] as const)(
  "resolves a timed-out transfer (%s) before the ask",
  (selection) => {
    const game = scriptedPreview([
      { op: "setAnswerer", mode: "byCurrent", select: selection },
      { op: "setPrice", mode: "select", range: { min: 300, max: 300, step: 0 } },
      numeric,
      { op: "askAnswer", mode: "direct", durationMs: null },
    ]);
    game.timeout();
    const recipient = selection === "any" ? 2 : 3;
    expect(game.session.state).toMatchObject({
      secretQuestionData: null,
      answeringPlayer: recipient,
      currentQuestion: { realPrice: 300 },
      timer: { durationMs: 60_000 },
    });
    game.command({ type: "question-skip", payload: undefined }, recipient);
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.players.find((p) => p.meta.id === recipient)?.score).toBe(700);
    game.dispose();
  },
);

it("waits for all final selections and lets only the showman score the submitted options", () => {
  const game = scriptedPreview(
    [
      { op: "setAnswerer", mode: "all" },
      { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
      { op: "askAnswer", mode: "direct", durationMs: null },
    ],
    true,
  );
  expect(game.session.state.timer?.durationMs).toBe(75_000);
  game.command({ type: "all-play-review", payload: { playerId: 2, isCorrect: true } }, 1);
  expect(game.session.state.questionState).toBe("showing");
  game.command(
    { type: "final-answer-submit", payload: { answerText: "Second", choiceOrder: 0 } },
    2,
  );
  expect(game.session.state.allPlay?.entries.find((entry) => entry.playerId === 2)?.submitted).toBe(
    false,
  );
  for (const sender of [2, 3, 4]) {
    game.command(
      {
        type: "final-answer-submit",
        payload: {
          answerText: sender === 2 ? "Second" : "First",
          choiceOrder: sender === 2 ? 1 : 0,
        },
      },
      sender,
    );
  }
  expect(game.session.state.questionState).toBe("reviewing");
  expect(game.session.state.allPlay?.entries.map((entry) => entry.choiceOrder)).toEqual([1, 0, 0]);
  game.command({ type: "all-play-review", payload: { playerId: 2, isCorrect: false } }, 3);
  for (const id of [2, 3, 4]) {
    game.command({ type: "all-play-review", payload: { playerId: id, isCorrect: id === 2 } }, 1);
  }
  expect(game.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual([
    1100, 900, 900,
  ]);
  expect(game.session.state.questionState).toBe("showing_answer");
  game.dispose();
});

it("uses the last authored occurrence for a point ask and blocks a broken draft before playtest", async () => {
  const image = '<item type="image" isRef="true">map.png</item>';
  const xml = `<package name="P"><rounds><round name="R"><themes><theme name="T"><questions>
    <question type="custom" price="100"><right><answer>0.4,0.6</answer></right><script>
      <step><param name="content" type="content">${image}<item>Middle</item>${image}</param></step>
      <step type="setAnswerType"><param name="type">point</param></step>
      <step type="askAnswer"><param name="mode">direct</param></step>
    </script></question></questions></theme></themes></round></rounds></package>`;
  const parsed = await parseSiq({
    "content.xml": new TextEncoder().encode(xml),
    "Images/map.png": new Uint8Array([1]),
  });
  const upload = parsed.content.rounds[0]!.themes[0]!.questions[0]!;
  expect(upload.script).toBeTruthy();
  const draft = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
  const question = previewQuestion(draft, false, new Map());
  const game = new PreviewRuntime(
    initialPreview(
      false,
      "Cell theme",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    question,
  );
  game.pick();
  game.ready();
  game.timeout();
  const active = game.session.state.currentQuestion;
  expect(active?.answerType).toBe("point");
  expect(active?.pointImageOrder).toBe(2);
  expect(active?.questionFiles?.[0]?.file.md5).toBe(active?.questionFiles?.[1]?.file.md5);
  game.dispose();

  upload.questionFiles = upload.questionFiles?.filter((file) => file.order !== 2);
  upload.textItems = [];
  const broken = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
  const issues: string[] = [];
  checkQuestion(
    broken,
    false,
    (severity, code) => {
      if (severity === "critical") issues.push(code);
    },
    () => true,
  );
  expect(issues).toContain("scriptRepair");
});

it("uses source nominals from eliminated themes for final script ranges in playtest", () => {
  const draft = newQuestion(null, {
    realPrice: 100,
    script: {
      version: 1,
      steps: [
        { op: "setAnswerer", mode: "current" },
        { op: "announcePrice", range: { min: 0, max: 0, step: 0 } },
        { op: "setPrice", mode: "select", range: { min: 0, max: 0, step: 0 } },
        { op: "askAnswer", mode: "direct", durationMs: 15000 },
      ],
    },
  });
  const round = newRound("F", "final");
  round.themes = [
    newTheme("Selected", [draft]),
    newTheme("Other", [newQuestion(null, { realPrice: 300 })]),
  ];
  const question = previewQuestion(draft, true, new Map());
  const game = new PreviewRuntime(
    initialPreview(
      true,
      "Selected",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    question,
    undefined,
    undefined,
    finalPreviewRoundPrices(round, draft),
  );
  game.command({ type: "theme-eliminate", payload: { themeId: 10 } }, 1);
  game.command({ type: "theme-eliminate", payload: { themeId: 11 } }, 1);
  expect(game.session.state.scriptView).toMatchObject({
    waitingFor: "price",
    priceRange: { min: 100, max: 300, step: 200 },
  });
  game.dispose();
});

it("opens a fixed actual and current select labels in the player preview", () => {
  const draft = newQuestion(100, {
    realPrice: 500,
    options: [
      { id: "spring", text: "Equinox", file: null, scriptOrder: 0, sourceLabel: "SPRING" },
      { id: "summer", text: "Solstice", file: null, scriptOrder: 1, sourceLabel: "SOLSTICE" },
      { id: "future", text: "Future option", file: null, scriptOrder: 2, sourceLabel: "FUTURE" },
    ],
    script: {
      version: 1,
      steps: [
        { op: "setAnswerer", mode: "current" },
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        { op: "askAnswer", mode: "direct", durationMs: 15000 },
      ],
    },
  });
  const question = previewQuestion(draft, false, new Map());
  const game = new PreviewRuntime(
    initialPreview(
      false,
      "T",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    question,
  );
  game.pick();
  const state = game.store.getState().session?.state;
  expect(state?.currentQuestion).toMatchObject({ price: 100, realPrice: 500 });
  expect(state?.currentQuestion?.answers?.map(({ order }) => order)).toEqual([0, 1]);
  expect(state?.currentQuestion?.answers).toMatchObject([
    { sourceLabel: "SPRING" },
    { sourceLabel: "SOLSTICE" },
  ]);
  expect(state?.currentQuestion).not.toHaveProperty("correctChoiceOrder");
  expect(state?.scriptView?.scoreEstimate?.win).toBe(500);
  game.dispose();
});

it("shows the same no-risk amount as the scripted verdict in preview", () => {
  const draft = newQuestion(100, {
    script: {
      version: 1,
      steps: [
        { op: "setAnswerer", mode: "current" },
        { op: "setPrice", mode: "noRisk" },
        { op: "askAnswer", mode: "direct", durationMs: 15000 },
      ],
    },
  });
  const question = previewQuestion(draft, false, new Map());
  const game = new PreviewRuntime(
    initialPreview(
      false,
      "T",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    question,
  );
  game.pick();
  expect(game.store.getState().session?.state.scriptView?.scoreEstimate).toEqual({
    win: 200,
    lose: 0,
  });
  game.command({ type: "answer-submitted", payload: { answerText: "test" } }, 2);
  game.command({ type: "answer-result", payload: { answerType: "wrong", scoreResult: 0 } }, 1);
  expect(game.session.players.find((player) => player.meta.id === 2)?.score).toBe(1000);
  game.dispose();
});

it("A24 local playtest executes both asks, per-step durations, scores and right fallback", async () => {
  const parsed = await parseSiq({ "content.xml": new TextEncoder().encode(fixture) });
  const draft = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
  const question = previewQuestion(draft, false, new Map());
  const game = new PreviewRuntime(
    initialPreview(
      false,
      "Cell theme",
      question,
      {
        showman: "Host",
        players: ["P1", "P2", "P3"],
        spectator: "Viewer",
        round: "R",
        final: "F",
        theme: "T",
      },
      () => 0,
    ),
    question,
  );
  game.pick();
  expect(game.session.state.currentQuestion?.textItems?.[0]?.text).toBe("First prompt");
  game.timeout();
  expect(game.session.state.timer?.durationMs).toBe(15000);
  game.command({ type: "answer-submitted", payload: { answerText: "42" } }, 2);
  expect(game.session.state.currentQuestion?.textItems?.[0]?.text).toBe("Second prompt");
  expect(game.session.players.find((player) => player.meta.id === 2)?.score).toBe(1100);
  expect(game.store.getState().session?.state.answerShowData).toBeNull();
  game.timeout();
  expect(game.session.state.timer?.durationMs).toBe(2000);
  game.command({ type: "answer-submitted", payload: { answerText: "42" } }, 2);
  expect(game.session.players.find((player) => player.meta.id === 2)?.score).toBe(1200);
  expect(game.session.state.currentQuestion?.text).toBe("42");
  game.setPerspective(5);
  const reveal = game.store.getState().session?.state.answerShowData;
  expect(reveal).toMatchObject({
    answerText: "42",
    answerResult: { player: 2, answerType: "correct", result: 100, score: 1200 },
  });
  expect(reveal).not.toHaveProperty("answerResult.answerText");
  expect(JSON.stringify(game.store.getState().session)).not.toContain('"steps"');
  expect(game.store.getState().session?.state.currentQuestion?.answerNumber).toBeUndefined();
  game.dispose();
});
