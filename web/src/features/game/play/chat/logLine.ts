import type { ChatSystemEntry } from "@/game/protocol";
import { formatScore, formatSigned } from "@/lib/format";

type T = (key: string, options?: Record<string, unknown>) => string;

/** A showman action from the log, in the reader's language. */
export function logLine(t: T, entry: ChatSystemEntry, fallback: string): string {
  const p = entry.params;
  const player = typeof p.player === "string" && p.player ? p.player : t("chat.someone");
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  switch (entry.action) {
    case "point-summary": {
      const summary = p.players
        ? t("reveal.correctPlayers", { players: p.players })
        : t(p.unresolved ? "reveal.unresolved" : "reveal.nobody");
      return p.players && p.unresolved ? `${summary} ${t("reveal.unresolved")}` : summary;
    }
    case "start":
      return t("chat.log.start");
    case "pause":
      return t("chat.log.pause");
    case "unpause":
      return t("chat.log.unpause");
    case "skip-question-force":
      return t("chat.log.reveal");
    case "buzzer-open":
      return t("chat.log.buzzerOpen");
    case "next-round":
      return p.round ? t("chat.log.nextRoundNamed", { round: p.round }) : t("chat.log.nextRound");
    case "question-pick":
      return t("chat.log.pick", { theme: p.theme, price: formatScore(num(p.price)) });
    case "question-remove-restore":
      return t(p.removed ? "chat.log.toggleRemoved" : "chat.log.toggleRestored", {
        theme: p.theme,
        price: formatScore(num(p.price)),
      });
    case "answer-result":
      return t(
        p.answerType === "skip"
          ? "chat.log.answerSkipped"
          : p.answerType === "correct"
            ? "chat.log.answerRight"
            : "chat.log.answerWrong",
        { player, points: formatSigned(num(p.points)) },
      );
    case "answer-result-undo":
      return t("chat.log.undo", { player, points: formatSigned(num(p.points)) });
    case "game-join-mode-change":
      return t("chat.log.joinMode", { mode: t(`menu.joinModes.${String(p.joinMode)}`) });
    case "game-settings-change":
      return t("chat.log.rules", { changes: ruleChanges(t, p) });
    case "player-kick":
      return t("chat.log.kick", { player });
    case "player-restriction":
      return t(
        p.banned
          ? "chat.log.restrictBanned"
          : p.restricted
            ? "chat.log.restrictRestricted"
            : p.muted
              ? "chat.log.restrictMuted"
              : "chat.log.restrictCleared",
        { player },
      );
    case "player-role-change":
      return t("chat.log.role", { player, role: t(`roles.${String(p.role)}`) });
    case "player-score-change":
      return t("chat.log.score", { player, score: formatScore(num(p.score)) });
    case "player-slot-change":
      return t("chat.log.slot", { player, slot: num(p.slot) });
    case "turn-player-change":
      return p.player ? t("chat.log.turn", { player }) : t("chat.log.turnNone");
    case "secret-question-transfer":
      return t("chat.log.secret", { player });
    case "all-play-review":
    case "final-answer-review":
      return t(p.correct ? "chat.log.reviewRight" : "chat.log.reviewWrong", { player });
    case "theme-eliminate":
      return t("chat.log.theme", { theme: p.theme ?? "" });
    default:
      return fallback;
  }
}

const TIMER_KEYS = [
  "answerMs",
  "answerSubmitMs",
  "stakeMs",
  "secretTransferMs",
  "allPlayAnswerMs",
  "finalAnswerMs",
];

/** "False starts: off; Time to answer after pressing: 10 sec." from the changed rules. */
function ruleChanges(t: T, p: ChatSystemEntry["params"]): string {
  const onOff = (on: boolean) => t(on ? "chat.log.ruleOn" : "chat.log.ruleOff");
  const parts: string[] = [];
  if (typeof p.falseStart === "boolean")
    parts.push(`${t("create.rules.falseStart")}: ${onOff(p.falseStart)}`);
  if (typeof p.buttonPressMode === "string")
    parts.push(`${t("create.rules.pressMode")}: ${t(`create.rules.modes.${p.buttonPressMode}`)}`);
  if (typeof p.wrongAnswerPenalty === "string")
    parts.push(`${t("create.rules.penalty")}: ${onOff(p.wrongAnswerPenalty === "subtract")}`);
  if (typeof p.roundMs === "number")
    parts.push(
      `${t("create.rules.roundLimit")}: ${
        p.roundMs === 0
          ? t("create.rules.noLimit")
          : t("create.rules.minutes", { count: Math.round(p.roundMs / 60_000) })
      }`,
    );
  for (const key of TIMER_KEYS) {
    const ms = p[key];
    if (typeof ms === "number")
      parts.push(
        `${t(`create.rules.timer.${key}`)}: ${t("create.rules.seconds", { count: ms / 1000 })}`,
      );
  }
  return parts.join("; ");
}
