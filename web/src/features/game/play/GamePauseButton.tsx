import { useTranslation } from "react-i18next";

import { useGameStore } from "@/game/store";
import { Button, type ButtonProps } from "@/ui/Button";
import { PauseIcon, PlayIcon } from "@/ui/icons";
import { useGame, useSession } from "../GameContext";

/** Every pause/resume entry point waits for the same server acknowledgement. */
export function GamePauseButton({
  children,
  size = "sm",
  variant,
}: Pick<ButtonProps, "children" | "size" | "variant">) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const session = useSession();
  const online = useGameStore((s) => s.connection === "connected");
  const pending = useGameStore((s) => s.pending?.action);
  const busy = pending === "game-pause" || pending === "game-unpause";
  const paused = session.state.isPaused;
  const label = t(paused ? "game.resume" : "game.pause");

  return (
    <Button
      size={size}
      variant={variant ?? (paused ? "accent" : "ghost")}
      disabled={!online || busy}
      aria-busy={busy || undefined}
      aria-label={label}
      title={!online ? t("reasons.connection_lost") : undefined}
      icon={paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
      onClick={() => connection.emit(paused ? "game-unpause" : "game-pause")}
    >
      {children ?? label}
    </Button>
  );
}
