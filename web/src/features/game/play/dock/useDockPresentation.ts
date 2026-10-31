import { useCountdown } from "@/lib/useCountdown";
import { useGame, useGameState, useSession } from "../../GameContext";
import { useDockModel } from "./useDockModel";
import { myRole, phaseOf, type Phase } from "@/game/selectors";

const RING_COLORS: Partial<Record<Phase, string>> = {
  media: "var(--oq-info)",
  answering: "var(--oq-success)",
  reveal: "var(--oq-success)",
  final_reviewing: "var(--oq-success)",
  all_play_reviewing: "var(--oq-success)",
  finished: "var(--oq-success)",
};

function countdownLabel(
  phase: Phase,
  offline: boolean,
  paused: boolean,
  left: number | null,
  fallback: string | undefined,
) {
  if (phase === "finished") return "✓";
  if (offline) return "…";
  if (paused) return "II";
  return left == null ? (fallback ?? "") : undefined;
}

export function useDockPresentation() {
  const session = useSession();
  const { myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";
  const connection = useGameState((s) => s.connection);
  const phase = phaseOf(session);
  const s = session.state;
  const paused = s.isPaused;
  // While media loads there is no countdown to show: the question timer only
  // starts once every player has the question in front of them.
  const { left, fraction } = useCountdown(
    phase === "finished" || phase === "media" ? null : s.timer,
    paused,
  );
  const model = useDockModel(session, myId);
  const offline = connection !== "connected";

  const ringLabel = countdownLabel(phase, offline, paused, left, model.ringLabel);

  const ringColor = offline
    ? "var(--oq-danger)"
    : paused || (left == null && phase !== "finished")
      ? "var(--oq-border-strong)"
      : (RING_COLORS[phase] ?? "var(--oq-accent)");
  return { model, phase, paused, offline, fraction, left, ringLabel, ringColor, isShowman };
}
