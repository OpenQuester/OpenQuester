import { mountGame } from "./round-transition.fixture";
import { ALICE, choosing, question, round, timer } from "../src/game/fixtures";
import { buildContentPlan } from "../src/game/contentPlan";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import type { QuestionFile } from "../src/game/protocol";

export const layouts = {
  "short-text": { audio: 0, images: 0, background: false },
  "answer-text": { audio: 0, images: 0, background: false },
  "final-text": { audio: 0, images: 0, background: false },
  "ten-audio": { audio: 10, images: 0, background: false },
  "long-steps": { audio: 0, images: 0, background: false, noText: true },
  "audio-caption": { audio: 1, images: 0, background: false },
  "background-caption": { audio: 1, images: 0, background: true },
  "background-long-text": { audio: 1, images: 0, background: true, long: true },
  "three-audio": { audio: 3, images: 0, background: false },
  "two-backgrounds-image": { audio: 2, images: 1, background: true },
  "audio-two-images": { audio: 1, images: 2, background: false },
  "audio-two-videos": { audio: 1, images: 0, videos: 2, background: false },
  "three-images": { audio: 0, images: 3, background: false },
  "one-image": { audio: 0, images: 1, background: false, noText: true },
  "many-audios": { audio: 10, images: 0, background: false, long: true },
  "queue-five": { audio: 1, images: 3, videos: 2, background: false },
  "mixed-ten": { audio: 3, images: 4, videos: 3, background: false },
  "queue-ten": { audio: 0, images: 9, videos: 1, background: false },
  "max-timeline": { audio: 0, images: 10, background: false, groups: 30 },
  "max-mixed-timeline": { audio: 1, images: 7, videos: 2, background: false, groups: 30 },
  "four-images": { audio: 0, images: 4, background: false },
  "two-videos": { audio: 0, images: 0, background: false, videos: 2 },
  "legacy-audio": { audio: 2, images: 0, background: false },
  "answer-audio": { audio: 1, images: 0, background: false },
  "final-reveal": { audio: 1, images: 1, background: false },
  "final-audio": { audio: 1, images: 0, background: false },
} as const;

let mounted = false;
let questionId = 100;
export function mountMediaLayout(name: keyof typeof layouts, audioSrc = "/e2e/fixtures/clip.webm") {
  if (!mounted) {
    mountGame(0);
    mounted = true;
  }
  useSettings.getState().update({ pins: {}, volume: 0.3 });
  const layout = layouts[name];
  const files: QuestionFile[] = [];
  const append = (type: "audio" | "image" | "video", count: number) => {
    for (let i = 0; i < count; i++) {
      const order = files.length;
      files.push({
        order,
        displayTime: 60000,
        placement: type === "audio" && layout.background ? "background" : "screen",
        waitForFinish: false,
        file: {
          type,
          md5: `${type}-${order}`,
          link:
            type === "audio"
              ? audioSrc
              : type === "video"
                ? "/e2e/fixtures/clip.webm"
                : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='%23615cff'/%3E%3Ctext x='200' y='130' text-anchor='middle' font-size='60' fill='white'%3E${i + 1}%3C/text%3E%3C/svg%3E`,
        },
      });
    }
  };
  const groupCount = "groups" in layout ? layout.groups : 1;
  for (let group = 0; group < groupCount; group++) {
    append("audio", layout.audio);
    if ("videos" in layout) append("video", layout.videos);
    append("image", layout.images);
    const last = files.at(-1);
    if (last) last.waitForFinish = true;
  }
  const q = question(++questionId, {
    text:
      "noText" in layout
        ? null
        : "long" in layout
          ? "Name the game from its sound. ".repeat(100)
          : "Name the game from its sound",
    textOrder: files.length ? null : 0,
    questionFiles: files,
    textItems:
      name === "long-steps"
        ? ["A", "B"].map((label, order) => ({
            order,
            text: Array.from(
              { length: 40 },
              (_, index) => `${label}${index + 1} Keep the beginning of this long step readable.`,
            ).join("\n\n"),
          }))
        : undefined,
  });
  const plan = buildContentPlan({
    text: q.text,
    textOrder: q.textOrder,
    files,
    textItems: q.textItems,
  })!;
  const session = choosing();
  session.state = {
    ...session.state,
    currentQuestion: q,
    questionState: "showing",
    timer: timer(120000),
    questionContentPlan: plan,
  };
  session.content = { kind: "question", plan, timer: session.state.timer, frozenAtMs: null };
  if (name === "legacy-audio") session.content = null;
  if (name === "answer-audio" || name === "answer-text") {
    session.content = { kind: "answer", plan, timer: session.state.timer, frozenAtMs: null };
    session.state.questionState = "showing_answer";
    session.state.answerShowData = {
      answerText: "The answer",
      nextTurnPlayerId: null,
      answerFiles: files,
    };
  }
  if (name === "final-audio" || name === "final-reveal" || name === "final-text") {
    session.state.currentRound = round("final");
    session.state.questionState = "answering";
    session.state.finalRoundData = {
      phase: "answering",
      submittedBidPlayerIds: [ALICE],
      bids: { [ALICE]: 100 },
      answers: [],
      turnOrder: [ALICE],
      eliminatedThemes: [],
      questionData: { themeId: 10, themeName: "Audio", question: q, contentPlan: plan },
    };
  }
  const store = useGameStore.getState();
  store.setSession(session);
  if (name === "final-reveal") {
    store.dispatch({
      type: "final-submit-end",
      payload: {
        phase: "answering",
        nextPhase: "reviewing",
        bids: { [ALICE]: 100 },
        allReviews: [],
      },
    });
    store.dispatch({
      type: "question-finish",
      payload: {
        answerFiles: files,
        answerText: "The final answer",
        nextTurnPlayerId: null,
        answerContentPlan: plan,
        timer: timer(65000),
      },
    });
  }
}

export function seekMediaLayout(elapsedMs?: number) {
  const session = useGameStore.getState().session!;
  const plan = session.content!.plan;
  const clock = { ...timer(plan.totalMs + 30000), elapsedMs: elapsedMs ?? plan.totalMs + 1 };
  useGameStore.getState().setSession({
    ...session,
    state: { ...session.state, timer: clock },
    content: { ...session.content!, timer: clock },
  });
}
