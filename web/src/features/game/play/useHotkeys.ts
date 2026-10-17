import { useEffect } from "react";

import { canBuzz, myRole, phaseOf, questionValue } from "@/game/selectors";
import { useGameStore } from "@/game/store";

import { useGame } from "../GameContext";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-no-shortcuts]")) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Space buzzes, C/W judge, 1–4 pick a choice option, T opens chat, ? the menu. */
export function useHotkeys({ onChat, onMenu }: { onChat: () => void; onMenu: () => void }) {
  const { connection, myId } = useGame();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const session = useGameStore.getState().session;
      if (!session) return;
      const role = myRole(session, myId);
      const phase = phaseOf(session);
      const key = e.key.toLowerCase();

      if (e.code === "Space" || key === " ") {
        if (
          canBuzz(session, myId, connection.connected).ok &&
          useGameStore.getState().pending?.action !== "question-answer"
        ) {
          e.preventDefault();
          connection.emit("question-answer");
        } else if (role === "player") {
          e.preventDefault();
        }
        return;
      }
      if (
        role === "showman" &&
        phase === "answering" &&
        !session.state.isPaused &&
        (key === "c" || key === "w")
      ) {
        e.preventDefault();
        const value = questionValue(session);
        if (key === "c")
          connection.emit("answer-result", { scoreResult: value, answerType: "correct" });
        else connection.emit("answer-result", { scoreResult: -value, answerType: "wrong" });
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const btn = document.querySelector<HTMLButtonElement>(
          `[data-option="${key}"]:not(:disabled)`,
        );
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }
      if (key === "t") {
        e.preventDefault();
        onChat();
        return;
      }
      if (key === "?") {
        e.preventDefault();
        onMenu();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connection, myId, onChat, onMenu]);
}
