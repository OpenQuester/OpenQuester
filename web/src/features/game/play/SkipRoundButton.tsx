import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useGameStore } from "@/game/store";
import { Button, type ButtonProps } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

import { useGame, useSession } from "../GameContext";

/**
 * Showman: "Skip to next round", after a confirmation. Skipping drops every
 * question still on the board, so one stray tap must not end a round.
 */
export function SkipRoundButton({
  label,
  ...button
}: { label: string } & Omit<ButtonProps, "onClick" | "children">) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection } = useGame();
  const pending = useGameStore((s) => s.pending);
  const online = useGameStore((s) => s.connection === "connected");
  const disabled = session.state.isPaused || !online || pending?.action === "next-round";
  const reason = session.state.isPaused
    ? t("reasons.paused")
    : !online
      ? t("reasons.connection_lost")
      : undefined;
  const [open, setOpen] = useState(false);
  const round = session.state.currentRound;
  const left =
    round?.themes.reduce((n, theme) => n + theme.questions.filter((q) => !q.isPlayed).length, 0) ??
    0;

  return (
    <>
      <Button
        {...button}
        disabled={button.disabled || disabled}
        title={reason ?? button.title}
        onClick={() => setOpen(true)}
        data-testid="skip-round"
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("skipRound.title")}
        description={left > 0 ? t("skipRound.help", { count: left }) : t("skipRound.helpEmpty")}
        closeLabel={t("common.close")}
      >
        <div className="flex flex-wrap gap-3 p-5">
          {reason && <p className="m-0 basis-full text-sm text-muted">{reason}</p>}
          <Button
            variant="accent"
            size="lg"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              connection.emit("next-round");
              setOpen(false);
            }}
            data-testid="skip-round-confirm"
          >
            {t("skipRound.confirm")}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
