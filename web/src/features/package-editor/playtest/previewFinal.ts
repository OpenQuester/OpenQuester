import { phaseOf, remainingFinalThemes } from "@/game/selectors";
import type { AnswerReview } from "@/game/protocol";
import {
  clampPreviewScore,
  PREVIEW_FINAL_THEME,
  PREVIEW_PLAYERS,
  PREVIEW_SHOWMAN,
} from "./previewModel";
import { previewTimer, type PreviewCommand, type PreviewRuntime } from "./previewRuntime";

export function handleFinal(
  game: PreviewRuntime,
  command: PreviewCommand,
  sender = game.actor,
): boolean {
  const phase = phaseOf(game.session);
  const final = game.session.state.finalRoundData;
  if (!final) return false;
  if (phase === "final_elimination" && command.type === "theme-eliminate") {
    const id = command.payload.themeId;
    if (sender !== PREVIEW_SHOWMAN && sender !== game.session.state.currentTurnPlayerId)
      return true;
    if (
      id === PREVIEW_FINAL_THEME ||
      !remainingFinalThemes(game.session).some((theme) => theme.id === id)
    )
      return true;
    game.dispatch({
      type: "theme-eliminate",
      payload: {
        themeId: id,
        eliminatedBy: sender,
        nextPlayerId:
          PREVIEW_PLAYERS[(final.eliminatedThemes.length + 1) % PREVIEW_PLAYERS.length]!,
      },
    });
    if (remainingFinalThemes(game.session).length === 1)
      game.dispatch({
        type: "final-phase-complete",
        payload: { phase: "theme_elimination", nextPhase: "bidding", timer: previewTimer(45_000) },
      });
    else game.setClock(previewTimer(30_000));
    return true;
  }
  if (phase === "final_bidding" && command.type === "final-bid-submit") {
    bid(game, sender, command.payload.bid);
    return true;
  }
  if (phase === "final_answering" && command.type === "final-answer-submit") {
    answer(game, sender, command.payload.answerText);
    return true;
  }
  if (phase === "final_reviewing" && command.type === "final-answer-review") {
    if (sender === PREVIEW_SHOWMAN)
      review(game, command.payload.answerId, command.payload.isCorrect);
    return true;
  }
  return false;
}

function bid(game: PreviewRuntime, id: number, value: number) {
  const final = game.session.state.finalRoundData;
  const player = game.session.players.find((p) => p.meta.id === id);
  if (
    !final ||
    final.bids[String(id)] != null ||
    !player ||
    player.role !== "player" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > player.score
  )
    return;
  game.dispatch({ type: "final-bid-submit", payload: { playerId: id, bidAmount: value } });
  if (
    PREVIEW_PLAYERS.every(
      (playerId) => game.session.state.finalRoundData?.bids[String(playerId)] != null,
    )
  ) {
    const theme = game.session.state.currentRound?.themes.find(
      (item) => item.id === PREVIEW_FINAL_THEME,
    );
    game.dispatch({
      type: "final-question-data",
      payload: {
        questionData: {
          themeId: PREVIEW_FINAL_THEME,
          themeName: theme?.name ?? "",
          question: game.question,
        },
      },
    });
    game.dispatch({
      type: "final-phase-complete",
      payload: { phase: "bidding", nextPhase: "answering", timer: previewTimer(75_000) },
    });
  }
}

function answer(
  game: PreviewRuntime,
  id: number,
  value: string,
  reason: "empty_answer" | "timeout" = "empty_answer",
) {
  if (game.session.finalSubmitted.includes(id)) return;
  const text = value.trim();
  game.answers.set(id, text);
  game.dispatch({ type: "final-answer-submit", payload: { playerId: id } });
  if (!text) {
    const bidValue = game.session.state.finalRoundData?.bids[String(id)] ?? 0;
    const score = game.session.players.find((player) => player.meta.id === id)?.score ?? 0;
    game.dispatch({ type: "final-auto-loss", payload: { playerId: id, reason } });
    game.dispatch({
      type: "score-changed",
      payload: { playerId: id, newScore: clampPreviewScore(score - bidValue) },
    });
  }
  if (PREVIEW_PLAYERS.every((playerId) => game.session.finalSubmitted.includes(playerId))) {
    const reviews: AnswerReview[] = PREVIEW_PLAYERS.map((playerId) => {
      const text = game.answers.get(playerId) ?? "";
      return {
        playerId,
        answerId: `preview-${playerId}`,
        answerText: text,
        scoreChange: 0,
        answerType: text ? "pending" : "auto_loss",
        isCorrect: text ? null : false,
      };
    });
    game.dispatch({
      type: "final-submit-end",
      payload: { phase: "answering", nextPhase: "reviewing", allReviews: reviews },
    });
    if (reviews.every((item) => item.isCorrect != null)) finishFinal(game);
  }
}

function review(game: PreviewRuntime, id: string, correct: boolean) {
  const final = game.session.state.finalRoundData;
  const answer = final?.answers.find((item) => item.id === id);
  if (!answer || answer.isCorrect != null || answer.autoLoss) return;
  const bidValue = final?.bids[String(answer.playerId)] ?? 0;
  game.dispatch({
    type: "final-answer-review",
    payload: {
      answerId: id,
      playerId: answer.playerId,
      isCorrect: correct,
      scoreChange: correct ? bidValue : -bidValue,
    },
  });
  if (
    game.session.state.finalRoundData?.answers.every(
      (item) => item.isCorrect != null || item.autoLoss,
    )
  )
    finishFinal(game);
}

function finishFinal(game: PreviewRuntime) {
  game.finish();
  game.dispatch({ type: "game-finished", payload: {} });
}

export function timeoutFinal(game: PreviewRuntime): boolean {
  const phase = phaseOf(game.session);
  if (phase === "final_elimination") return continueFinal(game, "");
  if (phase === "final_bidding") {
    for (const id of PREVIEW_PLAYERS) {
      if (game.session.state.finalRoundData?.bids[String(id)] == null) bid(game, id, 1);
    }
    return true;
  }
  if (phase === "final_answering") {
    for (const id of PREVIEW_PLAYERS)
      if (!game.session.finalSubmitted.includes(id)) answer(game, id, "", "timeout");
    return true;
  }
  return false;
}

export function continueFinal(game: PreviewRuntime, text: string): boolean {
  const phase = phaseOf(game.session);
  const final = game.session.state.finalRoundData;
  if (!final) return false;
  if (phase === "final_elimination") {
    const theme = remainingFinalThemes(game.session).find(
      (item) => item.id !== PREVIEW_FINAL_THEME,
    );
    if (theme)
      handleFinal(
        game,
        { type: "theme-eliminate", payload: { themeId: theme.id } },
        PREVIEW_SHOWMAN,
      );
    return true;
  }
  if (phase === "final_bidding") {
    const next = PREVIEW_PLAYERS.find((id) => final.bids[String(id)] == null);
    if (next != null)
      bid(
        game,
        next,
        Math.min(100, game.session.players.find((p) => p.meta.id === next)?.score ?? 0),
      );
    return true;
  }
  if (phase === "final_answering") {
    answer(game, game.actor, text);
    return true;
  }
  if (phase === "final_reviewing") {
    if (final.answers.every((item) => item.isCorrect != null || item.autoLoss)) {
      if (!game.session.state.answerShowData) game.finish();
      else game.dispatch({ type: "game-finished", payload: {} });
    }
    return true;
  }
  return false;
}
