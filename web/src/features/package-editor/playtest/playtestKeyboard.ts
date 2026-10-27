import type { KeyboardEvent } from "react";
import { canBuzz, myRole, phaseOf, questionValue } from "@/game/selectors";
import type { PreviewRuntime } from "./previewRuntime";

/** Shortcuts stay inside this preview; live-game listeners retain their dialog guard. */
export function onPlaytestKey(
  event: KeyboardEvent<HTMLDivElement>,
  game: PreviewRuntime,
  perspective: number,
) {
  if (
    event.defaultPrevented ||
    event.nativeEvent.isComposing ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable=false]), [data-no-shortcuts]",
      ))
  )
    return;
  const session = game.session;
  const role = myRole(session, perspective);
  const phase = phaseOf(session);
  const key = event.key.toLowerCase();
  if (event.code === "Space" || key === " ") {
    if (
      target instanceof HTMLElement &&
      target.closest(
        "button, a[href], summary, [role=button], [role=radio], [role=tab], [role=slider]",
      )
    )
      return;
    if (canBuzz(session, perspective).ok) {
      event.preventDefault();
      game.commands.emit("question-answer");
    } else if (role === "player") event.preventDefault();
    return;
  }
  if (
    role === "showman" &&
    phase === "answering" &&
    !session.state.isPaused &&
    (key === "c" || key === "w")
  ) {
    event.preventDefault();
    const value = questionValue(session);
    game.commands.emit("answer-result", {
      scoreResult: key === "c" ? value : -value,
      answerType: key === "c" ? "correct" : "wrong",
    });
    return;
  }
  if (/^[1-9]$/.test(key)) {
    const button = event.currentTarget.querySelector<HTMLButtonElement>(
      `[data-option="${key}"]:not(:disabled)`,
    );
    if (button && button.getClientRects().length) {
      event.preventDefault();
      button.click();
    }
  }
}
