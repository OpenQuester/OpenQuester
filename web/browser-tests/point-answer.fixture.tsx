import { createRoot, type Root } from "react-dom/client";
import { GameContext, type GameCommands } from "@/features/game/GameContext";
import { ALICE, BOB, question, round, session, timer } from "@/game/fixtures";
import { createGameStore } from "@/game/store";
import { buildContentPlan } from "@/game/contentPlan";
import { QuestionStage } from "@/features/game/play/QuestionStage";
import { AnswerReveal } from "@/features/game/play/question/AnswerReveal";
import { PointResults } from "@/features/game/play/question/PointResults";

let store = createGameStore();
let perspective = ALICE;
let root: Root;
let answer = "";
let shape = "wide";
const entry = (
  playerId: number,
  answer: string | null,
  submitted: boolean,
  isCorrect: boolean | null,
) => ({
  playerId,
  answer,
  submitted,
  isCorrect,
  scoreChange: isCorrect == null ? null : isCorrect ? 100 : -100,
  stake: null,
});
const allPlay = (entries: ReturnType<typeof entry>[]) => ({
  mode: "noRisk" as const,
  questionId: 100,
  price: 100,
  maxStake: null,
  priceMultiplier: null,
  entries,
});
function picture() {
  const [width, height] = shape === "tall" ? [300, 600] : [600, 300];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#4b6384"/><path d="M0 0 L${width} ${height} M${width} 0 L0 ${height}" stroke="#d8e7ff" stroke-width="4"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function pointQuestion() {
  return question(100, {
    answerType: "point",
    questionFiles: [
      { order: 0, displayTime: null, file: { md5: "img", type: "image", link: picture() } },
    ],
  });
}
function draw(reveal: boolean) {
  const emit: GameCommands["emit"] = (name, ...args) => {
    if (name === "all-play-answer") {
      answer = (args[0] as { answerText: string }).answerText;
      store.getState().dispatch({ type: "all-play-answer", payload: { playerId: perspective } });
    }
  };
  root.render(
    <GameContext.Provider
      value={{ store, myId: perspective, connection: { connected: true, emit } }}
    >
      <div className="min-h-screen bg-bg p-4 text-text">
        <div className="mx-auto flex min-h-[500px] max-w-[1100px] flex-col rounded-lg bg-surface p-4">
          {reveal ? <AnswerReveal /> : <QuestionStage />}
        </div>
      </div>
    </GameContext.Provider>,
  );
}
export function mountPoint(imageShape: "wide" | "tall") {
  shape = imageShape;
  answer = "";
  perspective = ALICE;
  store = createGameStore();
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: pointQuestion(),
      allPlay: allPlay([entry(ALICE, null, false, null), entry(BOB, null, false, null)]),
    }),
  });
  draw(false);
}
export function revealPoint() {
  store.setState({
    session: session({
      currentRound: round(),
      questionState: "showing_answer",
      currentQuestion: pointQuestion(),
      allPlay: allPlay([entry(ALICE, answer, true, true), entry(BOB, "0.8,0.3", true, false)]),
      answerShowData: {
        answerText: null,
        answerFiles: null,
        nextTurnPlayerId: null,
        answerPoint: { x: 0.25, y: 0.75 },
        answerDeviation: 0.15,
      },
    }),
  });
  draw(true);
}

export function changePointPerspective(id: number) {
  perspective = id;
  draw(false);
}
export function restartPoint() {
  perspective = ALICE;
  answer = "";
  store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: pointQuestion(),
      allPlay: allPlay([entry(ALICE, null, false, null), entry(BOB, null, false, null)]),
    }),
  });
  draw(false);
}
export function mountMarkerBounds() {
  shape = "tall";
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const name = "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW";
  root.render(
    <div className="mx-auto flex h-[500px] max-w-[343px] justify-center bg-bg p-4">
      <PointResults
        src={picture()}
        target={{ x: 0, y: 0 }}
        markers={[
          { id: 1, name, x: 0, y: 0, correct: true },
          { id: 2, name, x: 0.65, y: 0.5, correct: false },
          { id: 3, name, x: 1, y: 1, correct: false },
        ]}
      />
    </div>,
  );
}

/** Regular Buzz changes only interaction, not the displayed image geometry. */
export function mountRegular(imageShape: "wide" | "tall", sequence = false) {
  shape = imageShape;
  answer = "";
  perspective = ALICE;
  root?.unmount();
  store = createGameStore();
  const q = pointQuestion();
  if (sequence) {
    q.textOrder = 0;
    q.textItems = [];
    q.questionFiles![0]!.order = 1;
  }
  const questionTimer = sequence
    ? { ...timer(40_000), elapsedMs: 2500, resumedAt: new Date().toISOString() }
    : timer(40_000);
  const initial = session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: q,
    timer: questionTimer,
  });
  initial.content = {
    kind: "question",
    plan: buildContentPlan({
      text: q.text,
      textOrder: q.textOrder,
      textItems: q.textItems,
      files: q.questionFiles,
    })!,
    timer: questionTimer,
    frozenAtMs: null,
  };
  store.setState({ connection: "connected", session: initial });
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const emit: GameCommands["emit"] = (name, ...args) => {
    if (name === "answer-submitted") {
      answer = (args[0] as { answerText: string }).answerText;
      store.getState().dispatch({ type: "answer-submitted", payload: { answerText: answer } });
    }
  };
  root.render(
    <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
      <div className="min-h-screen bg-bg p-4 text-text">
        <div className="mx-auto flex min-h-[500px] max-w-[1100px] flex-col rounded-lg bg-surface p-4">
          <QuestionStage />
        </div>
      </div>
    </GameContext.Provider>,
  );
}
export function buzzRegular() {
  store
    .getState()
    .dispatch({ type: "question-answer", payload: { userId: ALICE, timer: timer(60_000) } });
}
export function regularAnswer() {
  return answer;
}
