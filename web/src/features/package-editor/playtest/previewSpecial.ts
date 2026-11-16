import { getRealPrice } from "@/game/questionPrices";
import { answerFormat } from "@/game/answerFormat";
import { previewChoiceSelection } from "./previewChoiceSelection";
import { timerElapsed } from "@/game/contentPlan";
import { startPreviewSecret, handlePreviewSecret, timeoutPreviewSecret } from "./previewSecret";
import { allPlayMaxStake, allPlayStakes, canAnswerNow, phaseOf, stakeInfo } from "@/game/selectors";
import type { AllPlayData } from "@/game/protocol";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { nextAuctionTurn } from "./previewAuction";
import {
  clampPreviewScore,
  PREVIEW_PLAYERS,
  PREVIEW_QUESTION,
  PREVIEW_SHOWMAN,
} from "./previewModel";
import { previewTimer, type PreviewCommand, type PreviewRuntime } from "./previewRuntime";

export function startSpecial(game: PreviewRuntime): boolean {
  const q = game.question;
  const all =
    q.subType === "forEveryone" && ["stake", "noRisk", "simple", "choice"].includes(q.type);
  if (all) {
    game.dispatch({
      type: "all-play-start",
      payload: {
        mode: q.type === "stake" ? "stake" : q.type === "noRisk" ? "noRisk" : "simple",
        questionId: PREVIEW_QUESTION,
        players: [...PREVIEW_PLAYERS],
        price: getRealPrice(q) ?? 0,
        wrongAnswerPenalty: game.session.settings?.wrongAnswerPenalty ?? "subtract",
        maxStake: q.maxPrice ?? null,
        priceMultiplier:
          q.priceMultiplier != null && Number.isFinite(q.priceMultiplier) && q.priceMultiplier > 0
            ? q.priceMultiplier
            : null,
        timer: q.type === "stake" ? previewTimer(30_000) : null,
      },
    });
    if (q.type !== "stake") game.showQuestion();
    return true;
  }
  if (q.type === "stake") {
    game.dispatch({
      type: "stake-question-picked",
      payload: {
        pickerPlayerId: PREVIEW_PLAYERS[0],
        questionId: PREVIEW_QUESTION,
        maxPrice: q.maxPrice ?? null,
        questionPrice: getRealPrice(q),
        biddingOrder: [...PREVIEW_PLAYERS],
        timer: previewTimer(30_000),
      },
    });
    return true;
  }
  if (q.type === "secret") {
    startPreviewSecret(game);
    return true;
  }
  return false;
}

export function handleSpecial(
  game: PreviewRuntime,
  command: PreviewCommand,
  sender: number,
): boolean {
  const phase = phaseOf(game.session);
  if (handlePreviewSecret(game, command, sender)) return true;
  if (phase === "stake_bidding" && command.type === "stake-bid-submit") {
    if (stakeInfo(game.session)?.bidderId === sender)
      bid(game, command.payload.bidType, command.payload.bidAmount);
    return true;
  }
  if (phase === "all_play_bidding" && command.type === "all-play-stake") {
    stake(game, sender, command.payload.amount);
    return true;
  }
  if (phase === "all_play_answering" && command.type === "all-play-answer") {
    if (canAnswerNow(game.session, sender))
      answer(game, sender, command.payload.answerText, command.payload.choiceOrder);
    return true;
  }
  if (phase === "all_play_reviewing" && command.type === "all-play-review") {
    if (sender === PREVIEW_SHOWMAN)
      review(game, command.payload.playerId, command.payload.isCorrect);
    return true;
  }
  return false;
}

function bid(
  game: PreviewRuntime,
  type: "normal" | "pass" | "all-in",
  input: number | null,
  timeout = false,
) {
  const info = stakeInfo(game.session);
  if (!info || info.bidderId == null) return;
  const { stake, bidderId, minBid } = info;
  if (type === "pass" && stake.highestBid == null) return;
  const player = game.session.players.find((p) => p.meta.id === bidderId);
  const amount = type === "pass" ? null : type === "all-in" ? (player?.score ?? 0) : input;
  if (!timeout && type === "normal" && nextAuctionTurn(stake, game.session.players).allIn) return;
  if (!timeout && type !== "pass" && (amount == null || !Number.isInteger(amount))) return;
  if (
    !timeout &&
    amount != null &&
    (amount < minBid ||
      amount > (player?.score ?? 0) ||
      (stake.maxPrice != null && amount > stake.maxPrice))
  )
    return;
  const passed = type === "pass" ? [...stake.passedPlayers, bidderId] : stake.passedPlayers;
  const bids = { ...stake.bids, [String(bidderId)]: amount };
  const highestBid =
    amount == null ? stake.highestBid : Math.max(stake.highestBid ?? amount, amount);
  const turn = nextAuctionTurn(
    { ...stake, bids, highestBid, passedPlayers: passed },
    game.session.players,
  );
  const actualType = type === "normal" && amount === player?.score ? "all-in" : type;
  game.dispatch({
    type: "stake-bid-submit",
    payload: {
      playerId: bidderId,
      bidAmount: amount,
      bidType: actualType,
      isPhaseComplete: turn.complete,
      nextBidderId: turn.next,
      timer: previewTimer(30_000),
    },
  });
  if (turn.complete && turn.winner != null) {
    const current = game.session.state.stakeQuestionData!;
    game.dispatch({
      type: "stake-question-winner",
      payload: { winnerPlayerId: turn.winner, finalBid: current.highestBid },
    });
    game.showQuestion();
  }
}

function stake(game: PreviewRuntime, id: number, amount: number) {
  const data = game.session.state.allPlay;
  const entry = data?.entries.find((item) => item.playerId === id);
  if (
    !data ||
    !entry ||
    entry.stake != null ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > allPlayMaxStake(game.session, id)
  )
    return;
  game.stakes.set(id, amount);
  game.dispatch({ type: "all-play-stake", payload: { playerId: id } });
  if (game.session.state.allPlay?.entries.every((item) => item.stake != null)) game.showQuestion();
}

function answer(game: PreviewRuntime, id: number, value: string, order?: number) {
  const entry = game.session.state.allPlay?.entries.find((item) => item.playerId === id);
  if (!entry || entry.submitted || !value.trim()) return;
  const state = game.session.state;
  if (
    answerFormat(game.question) === "select" &&
    timerElapsed(state.timer, state.isPaused) < (state.buzzerOpensAtMs ?? 0)
  )
    return;
  const selection = previewChoiceSelection(game.question, value, order);
  if (!selection) return;
  if (selection.choiceOrder !== undefined) game.choices.set(id, selection.choiceOrder);
  game.answers.set(id, value.trim());
  game.dispatch({ type: "all-play-answer", payload: { playerId: id } });
  if (game.session.state.allPlay?.entries.every((item) => item.submitted)) startReview(game);
}

function startReview(game: PreviewRuntime) {
  const data = game.session.state.allPlay;
  if (!data) return;
  const allPlay: AllPlayData = {
    ...data,
    entries: data.entries.map((entry) => {
      const value = game.answers.get(entry.playerId) ?? "";
      const stake = game.stakes.get(entry.playerId) ?? null;
      const verdict = value
        ? checkPreviewAnswer(
            game.question,
            value,
            game.choices.get(entry.playerId) ?? null,
            game.choices.has(entry.playerId),
          )
        : false;
      const score = allPlayStakes(game.session, { stake });
      return {
        ...entry,
        stake,
        answer: value,
        choiceOrder: game.choices.get(entry.playerId),
        isCorrect: verdict,
        scoreChange: verdict == null ? null : verdict ? score.win : score.lose,
      };
    }),
  };
  game.dispatch({ type: "all-play-reviewing", payload: { allPlay } });
  for (const player of game.session.players) {
    const score = clampPreviewScore(player.score);
    if (score !== player.score)
      game.dispatch({
        type: "score-changed",
        payload: { playerId: player.meta.id, newScore: score },
      });
  }
  if (allPlay.entries.every((entry) => entry.isCorrect != null)) game.finish();
}

export function timeoutSpecial(game: PreviewRuntime): boolean {
  const phase = phaseOf(game.session);
  if (phase === "all_play_answering") {
    startReview(game);
    return true;
  }
  if (phase === "all_play_bidding") {
    for (const id of PREVIEW_PLAYERS) {
      const entry = game.session.state.allPlay?.entries.find((item) => item.playerId === id);
      if (entry?.stake == null)
        stake(
          game,
          id,
          Math.min(
            Math.max(getRealPrice(game.question) ?? 0, 1),
            allPlayMaxStake(game.session, id),
          ),
        );
    }
    return true;
  }
  if (phase === "stake_bidding") {
    const info = stakeInfo(game.session);
    if (info)
      bid(
        game,
        info.stake.highestBid == null ? "normal" : "pass",
        info.stake.highestBid == null ? Math.max(getRealPrice(game.question) ?? 1, 1) : null,
        true,
      );
    return true;
  }
  if (phase === "secret_transfer") {
    timeoutPreviewSecret(game);
    return true;
  }
  return false;
}

function review(game: PreviewRuntime, id: number, correct: boolean) {
  const entry = game.session.state.allPlay?.entries.find((item) => item.playerId === id);
  if (!entry || entry.isCorrect != null) return;
  const score = allPlayStakes(game.session, entry);
  const delta = correct ? score.win : score.lose;
  const before = game.session.players.find((p) => p.meta.id === id)?.score ?? 0;
  game.dispatch({
    type: "all-play-review",
    payload: {
      playerId: id,
      isCorrect: correct,
      scoreChange: delta,
      newScore: clampPreviewScore(before + delta),
    },
  });
  if (game.session.state.allPlay?.entries.every((item) => item.isCorrect != null)) game.finish();
}
