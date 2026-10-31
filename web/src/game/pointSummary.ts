import type { GameSession } from "./reducer";
import { formatSigned } from "@/lib/format";

/** A local, translated transcript entry derived from the public reveal, never a chat send. */
export function withPointSummary(session: GameSession): GameSession {
  const state = session.state;
  if (!state.answerShowData?.answerPoint) return session;
  const entries =
    state.allPlay?.entries.map((e) => ({
      id: e.playerId,
      correct: e.isCorrect,
      points: e.scoreChange,
    })) ??
    (state.finalRoundData
      ? state.finalRoundData.answers.map((a) => ({
          id: a.playerId,
          correct: a.isCorrect,
          points: state.finalRoundData!.bids[a.playerId] ?? 0,
        }))
      : (
          state.answeredPlayers ??
          (state.answerShowData.answerResult ? [state.answerShowData.answerResult] : [])
        ).map((a) => ({ id: a.player, correct: a.answerType === "correct", points: a.result })));
  const correct = entries.filter((e) => e.correct === true);
  const players = correct
    .map(
      (e) =>
        `${session.players.find((p) => p.meta.id === e.id)?.meta.username ?? e.id}${e.points == null ? "" : ` (${formatSigned(e.points)})`}`,
    )
    .join(", ");
  const uuid = `point-summary:${state.currentRound?.id}:${state.currentQuestion?.id ?? state.finalRoundData?.questionData?.question.id}`;
  const existing = session.chat.find((m) => m.uuid === uuid);
  const message = {
    uuid,
    timestamp: existing?.timestamp ?? new Date().toISOString(),
    user: 0,
    message: "",
    system: {
      action: "point-summary",
      params: { players, unresolved: entries.some((e) => e.correct == null) },
    },
  };
  return {
    ...session,
    chat: existing
      ? session.chat.map((m) => (m.uuid === uuid ? message : m))
      : [...session.chat, message].slice(-200),
  };
}
