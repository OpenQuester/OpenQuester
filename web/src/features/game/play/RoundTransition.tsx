import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Round } from "@/game/protocol";
import { gameScreenStyles } from "./screen/gameScreenStyles";

import "./GameOverlay.css";

/** A local interlude; the authoritative game keeps running underneath. */
export function RoundTransition({ round }: { round: Round | null }) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const roundKey = round ? (round.id != null ? `id:${round.id}` : `order:${round.order}`) : null;
  const [previousKey, setPreviousKey] = useState(roundKey);
  const [visible, setVisible] = useState(false);

  if (previousKey !== roundKey) {
    setPreviousKey(roundKey);
    setVisible(roundKey != null);
  }

  // Open before paint so the updated board never appears without its backdrop.
  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current!;
    dialog.showModal();
    // Existing Radix sheets listen on document capture, ahead of dialog handlers.
    const blockBackgroundInput = (event: Event) => {
      event.stopPropagation();
      if (event instanceof KeyboardEvent && event.key === "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", blockBackgroundInput, true);
    window.addEventListener("pointerdown", blockBackgroundInput, true);
    // Keep the lifetime independent of CSS: reduced motion still lasts 3.5 seconds.
    const timeout = window.setTimeout(() => setVisible(false), 3500);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", blockBackgroundInput, true);
      window.removeEventListener("pointerdown", blockBackgroundInput, true);
      dialog.close();
    };
  }, [visible, roundKey]);

  if (!visible || !round) return null;

  return (
    <dialog
      key={roundKey}
      ref={dialogRef}
      onCancel={(event) => event.preventDefault()}
      className="oq-round-transition pointer-events-auto fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-6 text-center text-on-scrim outline-none"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="round-transition"
    >
      <div className={gameScreenStyles.overlayContent}>
        <h2 id={titleId} className={gameScreenStyles.overlayTitle}>
          {t(round.order === 0 ? "roundTransition.firstTitle" : "roundTransition.title")}
        </h2>
        <p
          id={descriptionId}
          className="m-0 max-w-3xl text-xl text-on-scrim-soft [overflow-wrap:anywhere] sm:text-2xl"
        >
          {t("roundTransition.description", { n: round.order + 1, name: round.name })}
        </p>
      </div>
    </dialog>
  );
}
