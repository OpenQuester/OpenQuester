import { describe, expect, it } from "vitest";
import { newQuestion } from "../packageDraft";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { initialPreview, PREVIEW_PLAYERS, PREVIEW_SHOWMAN, previewQuestion } from "./previewModel";
import { PreviewRuntime } from "./previewRuntime";
import { needsPlayerPerspective } from "./playtestGuidance";
import { useGameStore } from "@/game/store";
import { choosing } from "@/game/fixtures";

const names = {
  showman: "Host",
  players: ["P1", "P2", "P3"] as [string, string, string],
  spectator: "Spectator",
  round: "Round",
  final: "Final",
  theme: "Theme",
};
function setup(patch: Parameters<typeof newQuestion>[1] = {}, final = false) {
  const draft = newQuestion(100, { text: "Question", answerText: "42", ...patch });
  const question = previewQuestion(draft, final, new Map());
  return new PreviewRuntime(
    initialPreview(final, "Target", question, names, () => 0),
    question,
  );
}

describe("local question playtest", () => {
  it("shares authoritative rejected choices with the next player", () => {
    const game = setup({
      type: "choice",
      answerText: "Correct",
      options: [
        { id: "a", text: "Wrong", file: null },
        { id: "b", text: "Correct", file: null },
        { id: "c", text: "Other", file: null },
      ],
    });
    game.advance();
    game.advance();
    game.advanceWait();
    const [wrong, , other] = game.question.answers!;
    game.buzz(PREVIEW_PLAYERS[0]);
    game.submit("Wrong", wrong!.order);
    expect(game.session.state.answeredPlayers?.at(-1)).toMatchObject({
      answerType: "wrong",
      choiceOrder: wrong!.order,
    });
    game.buzz(PREVIEW_PLAYERS[1]);
    game.submit("Wrong", wrong!.order);
    expect(game.session.submittedAnswer).toBeNull();
    game.submit("Other", other!.order);
    expect(game.session.state.answeredPlayers?.at(-1)?.choiceOrder).toBe(other!.order);
  });

  it("keeps a manual skip distinct from a rejected image choice", () => {
    const game = setup({
      type: "choice",
      answerText: "Correct",
      options: [
        { id: "a", text: "", file: null },
        { id: "b", text: "Correct", file: null },
      ],
    });
    game.advance();
    game.advance();
    game.advanceWait();
    game.buzz(PREVIEW_PLAYERS[0]);
    game.submit("1", game.question.answers![0]!.order);
    expect(game.session.submittedAnswer).toBe("1");
    game.setPerspective(PREVIEW_SHOWMAN);
    const score = game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score;
    game.commands.emit("answer-result", { answerType: "skip", scoreResult: 0 });
    expect(game.session.state.answeredPlayers?.at(-1)).toMatchObject({
      answerType: "skip",
      result: 0,
    });
    expect(game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score).toBe(score);
    game.buzz(PREVIEW_PLAYERS[1]);
    game.submit("1", game.question.answers![0]!.order);
    expect(game.session.submittedAnswer).toBe("1");
  });

  it("automatically judges an authored image and reveals it only after the ruling", () => {
    const draft = newQuestion(100, {
      type: "choice",
      text: "Question",
      correctChoiceOptionId: "img",
      options: [
        { id: "img", text: "", file: { md5: "picture", type: "image" } },
        { id: "other", text: "1", file: null },
      ],
    });
    const question = previewQuestion(draft, false, new Map([["picture", "https://x/image"]]));
    const game = new PreviewRuntime(
      initialPreview(false, "Target", question, names, () => 0),
      question,
    );
    game.advance();
    game.advance();
    game.advanceWait();
    expect(game.store.getState().session?.state.currentQuestion).not.toHaveProperty(
      "correctChoiceOrder",
    );
    game.buzz(PREVIEW_PLAYERS[0]);
    game.submit("#1", 0);
    expect(game.session.lastResult?.answerType).toBe("correct");
    expect(game.session.state.answerShowData?.correctChoiceImage).toBe("https://x/image");
  });

  it("does not attach a rejected identity to an ambiguous legacy image placeholder", () => {
    const draft = newQuestion(100, {
      type: "choice",
      text: "Question",
      answerText: "1",
      options: [
        { id: "img", text: "", file: { md5: "picture", type: "image" } },
        { id: "other", text: "1", file: null },
      ],
    });
    const question = previewQuestion(draft, false, new Map());
    const game = new PreviewRuntime(
      initialPreview(false, "Target", question, names, () => 0),
      question,
    );
    game.advance();
    game.advance();
    game.advanceWait();
    game.buzz(PREVIEW_PLAYERS[0]);
    game.submit("1");
    expect(game.session.state.submittedChoiceOrder).toBeNull();
    game.setPerspective(PREVIEW_SHOWMAN);
    game.commands.emit("answer-result", { answerType: "wrong", scoreResult: 0 });
    expect(game.session.state.answeredPlayers?.at(-1)?.choiceOrder).toBeNull();
    game.buzz(PREVIEW_PLAYERS[1]);
    game.submit("1", 1);
    expect(game.session.lastResult?.answerType).toBe("correct");
  });
  it("reveals the numeric target rather than hidden draft text or aliases", () => {
    const game = setup({
      answerType: "number",
      answerNumber: -12.5,
      answerText: "Old answer",
      rightAnswers: ["Old right"],
      wrongAnswers: ["Old wrong"],
    });
    game.advance();
    game.advance();
    game.advance();
    game.commands.emit("question-answer");
    game.commands.emit("answer-submitted", { answerText: "-12.5" });
    expect(game.session.state.answerShowData).toMatchObject({
      answerText: "-12.5",
      rightAnswers: null,
    });
  });

  it("keeps the live game untouched and filters private answers before rendering", () => {
    const live = useGameStore.getState().session;
    const game = setup({ answerType: "number", answerNumber: 42, answerDeviation: 1 });
    game.advance();
    expect(game.store.getState().session?.state.currentQuestion).not.toHaveProperty("answerNumber");
    game.setPerspective(PREVIEW_SHOWMAN);
    expect(game.store.getState().session?.state.currentQuestion?.answerNumber).toBe(42);
    game.setPerspective(PREVIEW_PLAYERS[0]);
    game.advance();
    game.advance();
    game.commands.emit("question-answer");
    game.commands.emit("answer-submitted", { answerText: "42" });
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score).toBe(1100);
    expect(useGameStore.getState().session).toBe(live);
  });

  it("keeps pending preview text private and retains actual text after a manual ruling", () => {
    const game = setup({ answerText: "Canonical" });
    game.advance();
    game.advance();
    game.advanceWait();
    game.commands.emit("question-answer");
    game.commands.emit("answer-submitted", { answerText: "Different response" });
    game.setPerspective(5);
    expect(game.store.getState().session?.submittedAnswer).toBeNull();
    expect(game.store.getState().session?.state.submittedAnswer).toBeNull();
    game.setPerspective(PREVIEW_SHOWMAN);
    expect(game.store.getState().session?.submittedAnswer).toBe("Different response");
    game.commands.emit("answer-result", { answerType: "correct", scoreResult: 100 });
    expect(game.session.state.answeredPlayers?.at(-1)?.answerText).toBe("Different response");
    expect(game.session.state.answerShowData?.answerText).toBe("Canonical");
  });

  it("keeps the picker after wrong answers and gives the turn to a correct answerer", () => {
    const wrong = setup({ answerType: "number", answerNumber: 42 });
    wrong.advance();
    wrong.advance();
    wrong.advanceWait();
    for (const id of [PREVIEW_PLAYERS[1], PREVIEW_PLAYERS[2], PREVIEW_PLAYERS[0]]) {
      wrong.buzz(id);
      wrong.submit("41");
    }
    expect(wrong.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);

    const correct = setup({ answerType: "number", answerNumber: 42 });
    correct.advance();
    correct.advance();
    correct.advanceWait();
    correct.buzz(PREVIEW_PLAYERS[1]);
    correct.submit("42");
    expect(correct.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[1]);
  });

  it("hides the price of a hidden question on the board until it is picked", () => {
    const game = setup({ type: "hidden", price: 350 });
    const cell = game.session.state
      .currentRound!.themes.flatMap((theme) => theme.questions)
      .find((q) => q.id === 100);
    expect(cell?.price).toBeNull();
    game.advance();
    expect(game.session.state.currentQuestion?.price).toBe(350);
  });

  it("ignores stale commands and timers after the preview is disposed", () => {
    const game = setup();
    const before = game.session;
    game.dispose();
    game.advance();
    game.timeout();
    game.commands.emit("question-pick", { questionId: 100 });
    expect(game.session).toBe(before);
  });

  it("keeps a concurrently updating live game independent of the preview", () => {
    useGameStore.setState({ session: choosing() });
    const game = setup();
    const previewVersion = game.session.version;
    useGameStore
      .getState()
      .dispatch({ type: "score-changed", payload: { playerId: 2, newScore: 777 } });
    expect(useGameStore.getState().session?.players.find((p) => p.meta.id === 2)?.score).toBe(777);
    expect(game.session.version).toBe(previewVersion);
    game.advance();
    expect(useGameStore.getState().session?.players.find((p) => p.meta.id === 2)?.score).toBe(777);
    expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  });

  it("uses the visible player for game controls and never submits through Continue", () => {
    const game = setup({
      type: "noRisk",
      forEveryone: true,
      answerType: "number",
      answerNumber: 42,
    });
    game.advance();
    game.advance();
    game.setPerspective(PREVIEW_PLAYERS[1]);
    game.commands.emit("all-play-answer", { answerText: "42" });
    game.advance();
    expect(
      game.session.state.allPlay?.entries.find((entry) => entry.playerId === PREVIEW_PLAYERS[1])
        ?.submitted,
    ).toBe(true);
    expect(
      game.session.state.allPlay?.entries.find((entry) => entry.playerId === PREVIEW_PLAYERS[0])
        ?.submitted,
    ).toBe(false);
  });

  it("requires the actual answering player to submit, not Continue", () => {
    const game = setup({ answerType: "number", answerNumber: 42 });
    game.advance();
    game.advance();
    game.advanceWait();
    game.buzz(PREVIEW_PLAYERS[1]);
    game.advance();
    expect(game.session.state.questionState).toBe("answering");
    expect(game.session.submittedAnswer).toBeNull();
    game.setPerspective(PREVIEW_PLAYERS[1]);
    game.commands.emit("answer-submitted", { answerText: "42" });
    expect(game.session.state.questionState).toBe("showing_answer");
  });

  it("retains choice delay and does not use answerDelay for the question clock", () => {
    const game = setup({ type: "choice", text: "Hello", showDelay: 4000, answerDelay: 30_000 });
    game.advance();
    game.advance();
    expect(game.session.state.buzzerOpensAtMs).toBe(6000);
    expect(game.session.state.timer?.durationMs).toBe(26_500);
    game.commands.emit("question-answer");
    expect(game.session.state.buzzerLocks?.[String(PREVIEW_PLAYERS[0])]).toBeDefined();
    expect(game.session.state.questionState).toBe("showing");
  });

  it("requires transfer and custom price before showing a secret question", () => {
    const game = setup({
      type: "secret",
      transferType: "exceptCurrent",
      allowedPrices: [300, 500],
    });
    game.advance();
    expect(game.session.state.questionState).toBe("secret_transfer");
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[0])).toBe(false);
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[1])).toBe(true);
    expect(needsPlayerPerspective(game.session, PREVIEW_SHOWMAN)).toBe(false);
    const transferVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(transferVersion);
    game.commands.emit("secret-question-transfer", { targetPlayerId: PREVIEW_PLAYERS[1] });
    expect(game.session.state.secretQuestionData?.priceSelection?.playerId).toBe(
      PREVIEW_PLAYERS[1],
    );
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[0])).toBe(true);
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[1])).toBe(false);
    const priceVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(priceVersion);
    game.setPerspective(PREVIEW_PLAYERS[1]);
    game.commands.emit("secret-question-price", { price: 300 });
    expect(game.session.state.answeringPlayer).toBe(PREVIEW_PLAYERS[1]);
    expect(game.session.state.currentQuestion?.price).toBe(300);
  });

  it("runs an auction before the stake winner answers", () => {
    const game = setup({ type: "stake" });
    game.advance();
    const biddingVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(biddingVersion);
    game.commands.emit("stake-bid-submit", { bidType: "normal", bidAmount: 100 });
    game.setPerspective(PREVIEW_PLAYERS[1]);
    game.commands.emit("stake-bid-submit", { bidType: "pass", bidAmount: null });
    game.setPerspective(PREVIEW_PLAYERS[2]);
    game.commands.emit("stake-bid-submit", { bidType: "pass", bidAmount: null });
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.answeringPlayer).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(100);
  });

  it("can open a high-price auction and finishes immediately at its maximum", () => {
    const game = setup({ type: "stake", price: 2000, maxPrice: 2000 });
    game.advance();
    game.timeout();
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(2000);
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.questionState).toBe("answering");
  });

  it("ends an all-in auction when no other player can outbid it", () => {
    const game = setup({ type: "stake", price: 2000, maxPrice: 3000 });
    game.advance();
    game.commands.emit("stake-bid-submit", { bidType: "all-in", bidAmount: null });
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(2100);
    expect(game.session.state.questionState).toBe("answering");
  });

  it("holds timeout while paused and expires question and reveal when resumed", () => {
    const game = setup();
    game.advance();
    game.advance();
    game.pause(true);
    game.timeout();
    expect(game.session.state.questionState).toBe("showing");
    game.pause(false);
    game.timeout();
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
    game.timeout();
    expect(game.session.finished).toBe(true);
    game.pause(true);
    game.advance();
    expect(game.session.finished).toBe(true);
    expect(game.session.state.isPaused).toBe(false);
  });

  it("expires missing everyone-answer and final answers with the appropriate score", () => {
    const everyone = setup({
      type: "stake",
      forEveryone: true,
      answerType: "number",
      answerNumber: 42,
    });
    everyone.advance();
    everyone.timeout();
    everyone.advance();
    everyone.commands.emit("all-play-answer", { answerText: "42" });
    everyone.timeout();
    expect(everyone.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual(
      [1100, 900, 900],
    );

    const final = setup({}, true);
    final.timeout();
    final.timeout();
    final.timeout();
    expect(final.session.state.finalRoundData?.phase).toBe("answering");
    final.timeout();
    expect(final.session.finished).toBe(true);
    expect(final.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual([
      999, 999, 999,
    ]);
  });

  it("scores every player on a no-risk question without penalizing wrong answers", () => {
    const game = setup({
      type: "noRisk",
      forEveryone: true,
      priceMultiplier: 2,
      answerType: "number",
      answerNumber: 42,
    });
    game.advance();
    game.advance();
    for (const [id, value] of [
      [2, "42"],
      [3, "41"],
      [4, "42"],
    ] as const) {
      game.setPerspective(id);
      game.commands.emit("all-play-answer", { answerText: value });
    }
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual([
      1200, 1000, 1200,
    ]);
  });

  it("hides answers from the spectator until everyone-answer review and lets the showman judge", () => {
    const game = setup({ type: "noRisk", forEveryone: true });
    game.advance();
    game.advance();
    game.setPerspective(PREVIEW_SHOWMAN);
    expect(game.store.getState().session?.state.currentQuestion?.answerText).toBe("42");
    game.setPerspective(5);
    expect(game.store.getState().session?.state.currentQuestion).not.toHaveProperty("answerText");
    for (const id of PREVIEW_PLAYERS) {
      game.setPerspective(id);
      game.commands.emit("all-play-answer", { answerText: `Answer ${id}` });
    }
    expect(game.session.state.questionState).toBe("reviewing");
    game.setPerspective(5);
    expect(game.store.getState().session?.state.allPlay?.entries[0]?.answer).toBe("Answer 2");
    game.setPerspective(PREVIEW_SHOWMAN);
    for (const id of PREVIEW_PLAYERS)
      game.commands.emit("all-play-review", { playerId: id, isCorrect: id === PREVIEW_PLAYERS[1] });
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
  });

  it("keeps final answers for showman review even when they are numbers", () => {
    const game = setup({ answerType: "number", answerNumber: 42 }, true);
    expect(needsPlayerPerspective(game.session, PREVIEW_SHOWMAN)).toBe(false);
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[1])).toBe(true);
    const eliminationVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(eliminationVersion);
    game.setPerspective(PREVIEW_SHOWMAN);
    game.commands.emit("theme-eliminate", { themeId: 10 });
    game.commands.emit("theme-eliminate", { themeId: 11 });
    const biddingVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(biddingVersion);
    for (const id of PREVIEW_PLAYERS) {
      game.setPerspective(id);
      game.commands.emit("final-bid-submit", { bid: 100 });
    }
    expect(game.session.state.finalRoundData?.phase).toBe("answering");
    expect(needsPlayerPerspective(game.session, PREVIEW_PLAYERS[0])).toBe(false);
    expect(needsPlayerPerspective(game.session, PREVIEW_SHOWMAN)).toBe(true);
    const noBid = structuredClone(game.session);
    delete noBid.state.finalRoundData!.bids[String(PREVIEW_PLAYERS[0])];
    expect(needsPlayerPerspective(noBid, PREVIEW_PLAYERS[0])).toBe(true);
    const ineligible = structuredClone(game.session);
    ineligible.state.questionEligiblePlayers = [PREVIEW_PLAYERS[1]];
    expect(needsPlayerPerspective(ineligible, PREVIEW_PLAYERS[0])).toBe(true);
    const answerVersion = game.session.version;
    game.advance();
    expect(game.session.version).toBe(answerVersion);
    for (const id of PREVIEW_PLAYERS) {
      game.setPerspective(id);
      game.commands.emit("final-answer-submit", { answerText: "42" });
    }
    const answers = game.session.state.finalRoundData?.answers ?? [];
    expect(answers).toHaveLength(3);
    expect(answers.every((answer) => answer.isCorrect == null)).toBe(true);
    game.setPerspective(PREVIEW_SHOWMAN);
    game.command({
      type: "final-answer-review",
      payload: { answerId: answers[0]!.id, isCorrect: true },
    });
    expect(game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score).toBe(1100);
  });

  it("matches numeric, choice and modern point answer checking", () => {
    const number = setup({ answerType: "number", answerNumber: 42, answerDeviation: 1 }).question;
    expect(checkPreviewAnswer(number, "43")).toBe(true);
    expect(checkPreviewAnswer(number, "44")).toBe(false);
    const point = setup({
      answerType: "point",
      answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
      answerDeviation: 0.1,
    }).question;
    expect(checkPreviewAnswer(point, "0.5,0.7")).toBe(true);
    expect(checkPreviewAnswer(point, "0.5,0.71")).toBe(false);
    const choice = setup({
      type: "choice",
      answerText: "Blue",
      options: [
        { id: "a", text: "Blue", file: null },
        { id: "b", text: "Red", file: null },
      ],
    }).question;
    expect(checkPreviewAnswer(choice, "blue")).toBe(true);
    expect(checkPreviewAnswer(choice, "Red")).toBe(false);
  });
});
