import { formatScore } from "@/lib/format";

import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";

import { findPlayer, me as findMe, myRole, stakeInfo } from "@/game/selectors";

export function secretModel({
  t,
  session,
  myId,
  secretTarget: target,
}: ActionDockContext): ActionDockModel {
  const secret = session.state.secretQuestionData;
  const role = myRole(session, myId);
  const picker = findPlayer(session, secret?.pickerPlayerId);
  const selection = secret?.priceSelection;
  if (selection) {
    const chooser = findPlayer(session, selection.playerId)?.meta.username ?? "";
    const mine = selection.playerId === myId;
    return {
      status: mine ? t("dock.secret.priceYou") : t("dock.secret.priceOther", { name: chooser }),
      action: mine
        ? { kind: "secret-price", prices: selection.allowedPrices }
        : { kind: "info", text: t("dock.secret.priceWait", { name: chooser }) },
      next: t("dock.secret.priceNext"),
    };
  }
  const canChoose = secret?.pickerPlayerId === myId || role === "showman";
  const candidate = findPlayer(session, target);
  const targetPlayer =
    candidate?.role === "player" &&
    candidate.status === "in-game" &&
    !(secret?.transferType === "exceptCurrent" && candidate.meta.id === secret.pickerPlayerId)
      ? candidate
      : undefined;
  const price = session.state.currentQuestion?.price;
  return {
    status: canChoose
      ? targetPlayer
        ? t("dock.secret.giveQ", { name: targetPlayer.meta.username })
        : t("dock.secret.choose")
      : t("dock.secret.otherChoosing", { name: picker?.meta.username ?? "" }),
    action: canChoose
      ? {
          kind: "secret-transfer",
          target: targetPlayer
            ? { id: targetPlayer.meta.id, name: targetPlayer.meta.username }
            : null,
        }
      : { kind: "info", text: t("dock.secret.wait") },
    next:
      price != null
        ? t("dock.secret.next", { points: formatScore(price) })
        : t("dock.secret.nextNoPrice"),
  };
}

export function stakeModel({ t, session, myId, reason }: ActionDockContext): ActionDockModel {
  const info = stakeInfo(session);
  const mePlayer = findMe(session, myId);
  const myScore = mePlayer?.score ?? 0;
  const myTurn = info?.bidderId === myId && info?.stake.biddingPhase;
  const max = Math.min(
    info?.stake.maxPrice ?? Number.POSITIVE_INFINITY,
    Math.max(myScore, info?.minBid ?? 0),
  );
  const bidder = findPlayer(session, info?.bidderId);
  const next = t("dock.stake.next");
  if (!info) return { status: "", action: null, next };
  if (!myTurn) {
    return {
      status: t("dock.stake.waitFor", { name: bidder?.meta.username ?? "" }),
      action: {
        kind: "info",
        text:
          myRole(session, myId) === "player"
            ? reason(info.stake.passedPlayers.includes(myId) ? "already_done" : "not_your_turn")
            : t("dock.stake.watching"),
      },
      next,
    };
  }
  return {
    status:
      info.stake.highestBid != null
        ? t("dock.stake.beat", { amount: formatScore(info.stake.highestBid) })
        : t("dock.stake.open"),
    action: {
      kind: "bid",
      event: "stake-bid-submit",
      min: info.minBid,
      max: Number.isFinite(max) ? max : info.minBid,
      allIn: myScore > (info.stake.highestBid ?? 0) ? myScore : null,
    },
    next,
  };
}
