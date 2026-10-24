import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";

import { me as findMe, seatedPlayers } from "@/game/selectors";

export function choosingModel({
  t,
  session,
  myId,
  role,
  name,
  reason,
}: ActionDockContext): ActionDockModel {
  const s = session.state;
  const picker = s.currentTurnPlayerId;
  const mine = picker === myId;
  if (role === "showman") {
    return {
      status: picker
        ? t("dock.choosing.showmanStatus", { name: name(picker) })
        : session.turnUnknown
          ? t("dock.choosing.unknownShowman")
          : t("dock.choosing.youPick"),
      action: {
        kind: "info",
        text: picker
          ? t("dock.choosing.showmanInfo", { name: name(picker) })
          : t("dock.choosing.pickAny"),
        nextRound: true,
      },
      next: t("dock.choosing.next"),
    };
  }
  if (session.turnUnknown && !picker) {
    return {
      status: t("dock.choosing.unknown"),
      action: {
        kind: "info",
        text: role === "spectator" ? t("dock.choosing.watching") : t("dock.choosing.unknownInfo"),
      },
      next: t("dock.choosing.next"),
    };
  }
  return {
    status: mine
      ? t("dock.choosing.yourTurn")
      : picker
        ? t("dock.choosing.isPicking", { name: name(picker) })
        : t("dock.choosing.showmanPicks"),
    action: {
      kind: "info",
      text: mine
        ? t("dock.choosing.pickInfo")
        : role === "spectator"
          ? t("dock.choosing.watching")
          : reason("not_your_turn"),
    },
    next: mine ? t("dock.choosing.nextYou") : t("dock.choosing.next"),
  };
}

export function mediaModel({ t, session, reason }: ActionDockContext): ActionDockModel {
  const players = seatedPlayers(session).filter((p) => p.status === "in-game");
  const ready = players.filter((p) => p.mediaDownloaded).length;
  return {
    status: t("dock.media.status", { ready, total: players.length }),
    ringLabel: `${ready}/${players.length}`,
    action: { kind: "info", text: reason("waiting_for_media") },
    next: t("dock.media.next"),
  };
}

export function finishedModel({ t, session, myId }: ActionDockContext): ActionDockModel {
  const mePlayer = findMe(session, myId);
  const ranked = seatedPlayers(session).sort((a, b) => b.score - a.score);
  const place = mePlayer?.role === "player" ? ranked.findIndex((p) => p.meta.id === myId) + 1 : 0;
  return {
    status: place > 0 ? t("dock.finished.place", { n: place }) : t("dock.finished.status"),
    action: { kind: "home" },
    next: t("dock.finished.next"),
  };
}
