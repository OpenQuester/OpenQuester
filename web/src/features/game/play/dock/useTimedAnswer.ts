import { useEffect, useRef, useState } from "react";
import { useCountdown } from "@/lib/useCountdown";
import { useGame, useGameState, useGameStoreApi, useSession } from "../../GameContext";

/** Send the latest typed answer once, manually or at the timer deadline. */
export function useTimedAnswer(event: "final-answer-submit" | "all-play-answer") {
  const store = useGameStoreApi();
  const session = useSession();
  const { connection } = useGame();
  const [text, setText] = useState("");
  const autoAttempted = useRef(false);
  const pending = useGameState((s) => s.pending?.action === event);
  const online = useGameState((s) => s.connection === "connected");
  const disabled = session.state.isPaused || !online || pending;
  const { left } = useCountdown(session.state.timer, session.state.isPaused);

  const submit = (value: string) => {
    if (disabled || store.getState().pending?.action === event) return;
    autoAttempted.current = true;
    connection.emit(event, { answerText: value.trim() });
  };

  // At the buzzer, send whatever was typed rather than losing it.
  useEffect(() => {
    if (!autoAttempted.current && !disabled && left != null && left < 900 && text.trim())
      submit(text);
  });

  return { text, setText, submit, disabled };
}
