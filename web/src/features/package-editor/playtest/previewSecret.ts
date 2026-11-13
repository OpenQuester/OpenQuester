import { getRealPrice } from "@/game/questionPrices";
import { allowedSecretPrice } from "@/game/secretRules";
import type { SecretQuestionData } from "@/game/protocol";
import {
  clampPreviewScore,
  PREVIEW_PLAYERS,
  PREVIEW_QUESTION,
  PREVIEW_SHOWMAN,
} from "./previewModel";
import { previewTimer, type PreviewCommand, type PreviewRuntime } from "./previewRuntime";

function selection(
  game: PreviewRuntime,
  playerId: number,
): NonNullable<SecretQuestionData["priceSelection"]> | null {
  const q = game.question;
  if (q.realPrice != null) return null;
  const rule = q.secretRules?.priceRule;
  if (rule?.kind === "range")
    return {
      playerId,
      allowedPrices: [],
      range: { min: rule.min, max: rule.max, step: rule.step },
    };
  if (rule?.kind === "roundExtremes")
    return {
      playerId,
      allowedPrices: [...new Set([game.secretRoundPrices.min, game.secretRoundPrices.max])],
    };
  return !q.secretRules && q.allowedPrices?.length
    ? { playerId, allowedPrices: [...q.allowedPrices].sort((a, b) => a - b) }
    : null;
}

function announce(game: PreviewRuntime, data: SecretQuestionData): SecretQuestionData {
  const priceSelection = selection(game, data.pickerPlayerId);
  return {
    ...data,
    priceRevealed: true,
    announcedPrice: priceSelection ? null : getRealPrice(game.question),
    announcedRange: priceSelection?.range ?? null,
    announcedPrices: priceSelection?.allowedPrices ?? null,
  };
}

export function startPreviewSecret(game: PreviewRuntime): void {
  const q = game.question;
  let data: SecretQuestionData = {
    pickerPlayerId: PREVIEW_PLAYERS[0],
    transferType: q.transferType ?? "any",
    questionId: PREVIEW_QUESTION,
    transferDecisionPhase: true,
    step: "transfer",
    actorPlayerId: PREVIEW_PLAYERS[0],
    recipientPlayerId: null,
  };
  if (q.secretRules?.priceAnnouncement === "beforeTransfer") {
    data = announce(game, data);
    const priceSelection =
      q.secretRules.priceChooser === "opener" ? selection(game, PREVIEW_PLAYERS[0]) : null;
    if (priceSelection)
      data = { ...data, step: "price", transferDecisionPhase: false, priceSelection };
  }
  game.dispatch({
    type: "secret-question-picked",
    payload: {
      pickerPlayerId: data.pickerPlayerId,
      transferType: data.transferType,
      questionId: PREVIEW_QUESTION,
      secretQuestionData: data,
      timer: previewTimer(30_000),
    },
  });
}

export function handlePreviewSecret(
  game: PreviewRuntime,
  command: PreviewCommand,
  sender: number,
): boolean {
  const data = game.session.state.secretQuestionData;
  if (game.session.state.questionState !== "secret_transfer" || !data) return false;
  if (command.type === "secret-question-transfer") {
    const target = command.payload.targetPlayerId;
    if (
      !data.transferDecisionPhase ||
      (sender !== PREVIEW_SHOWMAN && sender !== data.pickerPlayerId) ||
      !PREVIEW_PLAYERS.some((id) => id === target) ||
      (data.transferType === "exceptCurrent" && data.pickerPlayerId === target)
    )
      return true;
    let next = announce(game, { ...data, recipientPlayerId: target, transferDecisionPhase: false });
    const priceSelection = selection(game, target);
    if (priceSelection) next = { ...next, step: "price", actorPlayerId: target, priceSelection };
    game.dispatch({
      type: "secret-question-transfer",
      payload: {
        fromPlayerId: data.pickerPlayerId,
        toPlayerId: target,
        questionId: data.questionId,
        secretQuestionData: priceSelection ? next : null,
        timer: previewTimer(30_000),
      },
    });
    if (!priceSelection) complete(game, target);
    return true;
  }
  if (command.type === "secret-question-price") {
    const chosen = data.priceSelection;
    const price = command.payload.price;
    if (!chosen || chosen.playerId !== sender || !allowedSecretPrice(chosen, price)) return true;
    game.question.realPrice = price;
    const opener =
      data.recipientPlayerId == null && game.question.secretRules?.priceChooser === "opener";
    const next = opener
      ? {
          ...data,
          step: "transfer" as const,
          actorPlayerId: data.pickerPlayerId,
          transferDecisionPhase: true,
          priceSelection: null,
          announcedPrice: price,
        }
      : null;
    game.dispatch({
      type: "secret-question-price",
      payload: {
        playerId: sender,
        price,
        questionId: data.questionId,
        secretQuestionData: next,
        timer: previewTimer(30_000),
      },
    });
    if (!opener) complete(game, data.recipientPlayerId ?? sender);
    return true;
  }
  return false;
}

function complete(game: PreviewRuntime, recipientPlayerId: number) {
  if (game.question.secretRules?.outcome === "award") {
    const price = getRealPrice(game.question) ?? 0;
    const before = game.session.players.find((p) => p.meta.id === recipientPlayerId)!.score;
    const newScore = clampPreviewScore(before + Math.min(price, 2_000_000));
    game.award({
      questionId: PREVIEW_QUESTION,
      recipientPlayerId,
      price,
      appliedChange: newScore - before,
      newScore,
      reason: "secretAward",
    });
  } else game.showQuestion();
}

export function timeoutPreviewSecret(game: PreviewRuntime): void {
  let selection = game.session.state.secretQuestionData?.priceSelection;
  if (!selection) {
    const transferType = game.session.state.secretQuestionData?.transferType;
    handlePreviewSecret(
      game,
      {
        type: "secret-question-transfer",
        payload: {
          targetPlayerId:
            transferType === "exceptCurrent" ? PREVIEW_PLAYERS[1] : PREVIEW_PLAYERS[0],
        },
      },
      PREVIEW_SHOWMAN,
    );
    // A timed-out legacy transfer resolves its short price list in the same step.
    if (game.question.secretRules) return;
    selection = game.session.state.secretQuestionData?.priceSelection;
  }
  if (selection)
    handlePreviewSecret(
      game,
      {
        type: "secret-question-price",
        payload: { price: selection.range?.min ?? selection.allowedPrices[0]! },
      },
      selection.playerId,
    );
}
