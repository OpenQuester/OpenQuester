import type { GameSession } from "./reducer";
import type { BoardQuestion, BoardTheme, Player, PlayerRole, Question } from "./protocol";

/**
 * Disabled-reason categories from docs/specs/game-state-matrix.md. Every
 * unavailable action in the UI names one of these, with a translated sentence.
 */
export type DisabledReason =
  | "wrong_role"
  | "wrong_phase"
  | "not_your_turn"
  | "already_done"
  | "not_eligible"
  | "waiting_for_media"
  | "waiting_for_server"
  | "connection_lost"
  | "paused"
  | "skipped";

export type Availability = { ok: true } | { ok: false; reason: DisabledReason };

const OK: Availability = { ok: true };
const no = (reason: DisabledReason): Availability => ({ ok: false, reason });

/** One label per visible phase; drives the dock, the banner and the stage. */
export type Phase =
  | "lobby"
  | "choosing"
  | "media"
  | "showing"
  | "answering"
  | "reveal"
  | "secret_transfer"
  | "stake_bidding"
  | "final_elimination"
  | "final_bidding"
  | "final_answering"
  | "final_reviewing"
  | "finished";

export function phaseOf(session: GameSession): Phase {
  const s = session.state;
  if (session.finished) return "finished";
  if (!s.currentRound) return "lobby";
  if (s.currentRound.type === "final" && s.finalRoundData) {
    switch (s.finalRoundData.phase) {
      case "theme_elimination":
        return "final_elimination";
      case "bidding":
        return "final_bidding";
      case "answering":
        return "final_answering";
      case "reviewing":
        return "final_reviewing";
    }
  }
  switch (s.questionState) {
    case "media_downloading":
      return "media";
    case "showing":
      return "showing";
    case "answering":
      return "answering";
    case "showing_answer":
      return "reveal";
    case "secret_transfer":
      return "secret_transfer";
    case "bidding":
      return "stake_bidding";
    case "theme_elimination":
      return "final_elimination";
    case "reviewing":
      return "final_reviewing";
    default:
      return "choosing";
  }
}

export function findPlayer(
  session: GameSession,
  id: number | null | undefined,
): Player | undefined {
  if (id == null) return undefined;
  return session.players.find((p) => p.meta.id === id);
}

export function me(session: GameSession, myId: number): Player | undefined {
  return findPlayer(session, myId);
}

export function myRole(session: GameSession, myId: number): PlayerRole {
  return me(session, myId)?.role ?? "spectator";
}

export function showman(session: GameSession): Player | undefined {
  return (
    session.players.find((p) => p.role === "showman" && p.status === "in-game") ??
    session.players.find((p) => p.role === "showman")
  );
}

/** Seated players in slot order, including disconnected ones (their seat is kept). */
export function seatedPlayers(session: GameSession): Player[] {
  return session.players
    .filter((p) => p.role === "player")
    .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
}

export function spectators(session: GameSession): Player[] {
  return session.players.filter((p) => p.role === "spectator" && p.status === "in-game");
}

export function isEligible(session: GameSession, id: number): boolean {
  const eligible = session.state.questionEligiblePlayers;
  return !eligible || eligible.length === 0 || eligible.includes(id);
}

export function hasAnswered(session: GameSession, id: number): boolean {
  return (session.state.answeredPlayers ?? []).some((a) => a.player === id);
}

export function hasSkipped(session: GameSession, id: number): boolean {
  return (session.state.skippedPlayers ?? []).includes(id);
}

/** Only one player answers noRisk, stake and secret questions; there is no buzzer race. */
export function isSingleAnswerer(question: Question | null | undefined): boolean {
  return question?.type === "noRisk" || question?.type === "stake" || question?.type === "secret";
}

/** Can I press the buzzer right now? */
export function canBuzz(session: GameSession, myId: number, connected = true): Availability {
  const role = myRole(session, myId);
  if (role !== "player") return no("wrong_role");
  if (!connected) return no("connection_lost");
  if (session.state.isPaused) return no("paused");
  const phase = phaseOf(session);
  if (phase === "media") return no("waiting_for_media");
  if (phase === "answering") {
    return session.state.answeringPlayer === myId ? no("already_done") : no("not_your_turn");
  }
  if (phase !== "showing") return no("wrong_phase");
  if (!isEligible(session, myId)) return no("not_eligible");
  if (hasAnswered(session, myId)) return no("already_done");
  if (hasSkipped(session, myId)) return no("skipped");
  return OK;
}

/** Can I pick this cell on the board? */
export function canPick(
  session: GameSession,
  myId: number,
  question?: BoardQuestion,
): Availability {
  const role = myRole(session, myId);
  if (role === "spectator") return no("wrong_role");
  if (session.state.isPaused) return no("paused");
  if (phaseOf(session) !== "choosing") return no("wrong_phase");
  if (question?.isPlayed) return no("already_done");
  if (role === "showman") return OK;
  if (session.state.currentTurnPlayerId !== myId) return no("not_your_turn");
  return OK;
}

export function isMyTurn(session: GameSession, myId: number): boolean {
  return session.state.currentTurnPlayerId === myId;
}

/** Score delta the showman awards for the current question. */
export function questionValue(session: GameSession): number {
  const q = session.state.currentQuestion;
  if (!q) return 0;
  if (q.type === "stake") {
    const bid = session.state.stakeQuestionData?.highestBid;
    if (bid != null) return bid;
  }
  const price = q.price ?? 0;
  if (q.type === "noRisk") return Math.round(price * (q.priceMultiplier ?? 1));
  return price;
}

/** Whether a wrong answer costs points on the current question. */
export function wrongCostsPoints(session: GameSession): boolean {
  return session.state.currentQuestion?.type !== "noRisk";
}

/** Final round: players who can still play (score above zero when the round began). */
export function finalPlayers(session: GameSession): Player[] {
  const order = session.state.finalRoundData?.turnOrder ?? [];
  const seated = seatedPlayers(session);
  if (order.length === 0) return seated;
  return order
    .map((id) => seated.find((p) => p.meta.id === id))
    .filter((p): p is Player => p != null);
}

export function remainingFinalThemes(session: GameSession): BoardTheme[] {
  const eliminated = new Set(session.state.finalRoundData?.eliminatedThemes ?? []);
  return (session.state.currentRound?.themes ?? []).filter((t) => !eliminated.has(t.id));
}

export function finalBid(session: GameSession, id: number): number | undefined {
  return session.state.finalRoundData?.bids[String(id)];
}

export function hasFinalBid(session: GameSession, id: number): boolean {
  return finalBid(session, id) != null;
}

/** Stake auction: who bids now and what the minimum next bid is. */
export function stakeInfo(session: GameSession) {
  const stake = session.state.stakeQuestionData;
  if (!stake) return null;
  const order = stake.biddingOrder;
  const bidderId =
    session.state.currentTurnPlayerId != null && order.includes(session.state.currentTurnPlayerId)
      ? session.state.currentTurnPlayerId
      : (order[stake.currentBidderIndex] ?? null);
  const price =
    session.state.currentQuestion?.price ?? stakePriceFromBoard(session, stake.questionId);
  const minBid = stake.highestBid != null ? stake.highestBid + 1 : (price ?? 1);
  return { stake, bidderId, minBid, price };
}

function stakePriceFromBoard(session: GameSession, questionId: number): number | null {
  for (const theme of session.state.currentRound?.themes ?? []) {
    for (const q of theme.questions) {
      if (q.id === questionId) return q.price;
    }
  }
  return null;
}

export function boardQuestionMeta(
  session: GameSession,
  questionId: number | undefined,
): { theme: BoardTheme; question: BoardQuestion } | null {
  if (questionId == null) return null;
  for (const theme of session.state.currentRound?.themes ?? []) {
    const question = theme.questions.find((q) => q.id === questionId);
    if (question) return { theme, question };
  }
  return null;
}

/** Players ranked by score, highest first; ties keep seat order. */
export function standings(session: GameSession): Player[] {
  return [...seatedPlayers(session)].sort((a, b) => b.score - a.score);
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_.-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
