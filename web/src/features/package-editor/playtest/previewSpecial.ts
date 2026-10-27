import { allPlayMaxStake, allPlayStakes, phaseOf, stakeInfo } from "@/game/selectors";
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
  const all = q.subType === "forEveryone" && (q.type === "stake" || q.type === "noRisk");
  if (all) {
    game.dispatch({
      type: "all-play-start",
      payload: {
        mode: q.type === "stake" ? "stake" : "noRisk",
        questionId: PREVIEW_QUESTION,
        players: [...PREVIEW_PLAYERS],
        price: q.price ?? 0,
        maxStake: q.maxPrice ?? null,
        priceMultiplier:
          q.priceMultiplier != null && Number.isFinite(q.priceMultiplier) && q.priceMultiplier > 0
            ? q.priceMultiplier
            : null,
        timer: q.type === "stake" ? previewTimer(30_000) : null,
      },
    });
    if (q.type === "noRisk") game.showQuestion();
    return true;
  }
  if (q.type === "stake") {
    game.dispatch({
      type: "stake-question-picked",
      payload: {
        pickerPlayerId: PREVIEW_PLAYERS[0],
        questionId: PREVIEW_QUESTION,
        maxPrice: q.maxPrice ?? null,
        biddingOrder: [...PREVIEW_PLAYERS],
        timer: previewTimer(30_000),
      },
    });
    return true;
  }
  if (q.type === "secret") {
    game.dispatch({
      type: "secret-question-picked",
      payload: {
        pickerPlayerId: PREVIEW_PLAYERS[0],
        transferType: q.transferType ?? "any",
        questionId: PREVIEW_QUESTION,
      },
    });
    game.setClock(previewTimer(30_000));
    return true;
  }
  return false;
}

export function handleSpecial(
  game: PreviewRuntime,
  command: PreviewCommand,
  sender = game.actor,
): boolean {
  const phase = phaseOf(game.session);
  const state = game.session.state;
  if (phase === "secret_transfer" && command.type === "secret-question-transfer") {
    const id = command.payload.targetPlayerId;
    if (sender !== PREVIEW_SHOWMAN && sender !== state.secretQuestionData?.pickerPlayerId)
      return true;
    if (!PREVIEW_PLAYERS.some((playerId) => playerId === id)) return true;
    if (state.secretQuestionData?.transferType === "exceptCurrent" && id === PREVIEW_PLAYERS[0])
      return true;
    game.dispatch({
      type: "secret-question-transfer",
      payload: {
        fromPlayerId: PREVIEW_PLAYERS[0],
        toPlayerId: id,
        questionId: PREVIEW_QUESTION,
        allowedPrices: game.question.allowedPrices,
        timer: previewTimer(30_000),
      },
    });
    if (!game.question.allowedPrices?.length) game.showQuestion();
    return true;
  }
  if (phase === "secret_transfer" && command.type === "secret-question-price") {
    const selection = state.secretQuestionData?.priceSelection;
    if (selection?.playerId === sender && selection.allowedPrices.includes(command.payload.price)) {
      game.dispatch({
        type: "secret-question-price",
        payload: {
          playerId: selection.playerId,
          price: command.payload.price,
          questionId: PREVIEW_QUESTION,
        },
      });
      game.question.price = command.payload.price;
      game.showQuestion();
    }
    return true;
  }
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
    answer(game, sender, command.payload.answerText);
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

function answer(game: PreviewRuntime, id: number, value: string) {
  const entry = game.session.state.allPlay?.entries.find((item) => item.playerId === id);
  if (!entry || entry.submitted || !value.trim()) return;
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
      const verdict = value ? checkPreviewAnswer(game.question, value) : false;
      const score = allPlayStakes(game.session, { stake });
      return {
        ...entry,
        stake,
        answer: value,
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
          Math.min(Math.max(game.question.price ?? 0, 1), allPlayMaxStake(game.session, id)),
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
        info.stake.highestBid == null ? game.question.price || 1 : null,
        true,
      );
    return true;
  }
  if (phase === "secret_transfer") return continueSpecial(game, "");
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

export function continueSpecial(game: PreviewRuntime, answerText: string): boolean {
  const phase = phaseOf(game.session);
  if (phase === "secret_transfer") {
    const secret = game.session.state.secretQuestionData;
    if (secret?.priceSelection)
      handleSpecial(
        game,
        {
          type: "secret-question-price",
          payload: { price: secret.priceSelection.allowedPrices[0]! },
        },
        secret.priceSelection.playerId,
      );
    else
      handleSpecial(
        game,
        {
          type: "secret-question-transfer",
          payload: {
            targetPlayerId:
              secret?.transferType === "exceptCurrent" && game.actor === PREVIEW_PLAYERS[0]
                ? PREVIEW_PLAYERS[1]
                : game.actor,
          },
        },
        PREVIEW_SHOWMAN,
      );
    return true;
  }
  if (phase === "stake_bidding") {
    const info = stakeInfo(game.session);
    if (info) bid(game, info.stake.highestBid == null ? "normal" : "pass", info.minBid);
    return true;
  }
  if (phase === "all_play_bidding") {
    const next = game.session.state.allPlay?.entries.find((entry) => entry.stake == null);
    if (next)
      stake(
        game,
        next.playerId,
        Math.min(
          Math.max(game.question.price ?? 0, 1),
          allPlayMaxStake(game.session, next.playerId),
        ),
      );
    return true;
  }
  if (phase === "all_play_answering") {
    answer(game, game.actor, answerText);
    return true;
  }
  return phase === "all_play_reviewing";
}
