import type { KeyboardEvent } from "react";

/** Arrow/Home/End selection for the existing button-based radio groups and tabs. */
export function onChoiceKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const group = event.currentTarget.closest('[role="radiogroup"], [role="tablist"]');
  if (!group) return;
  const items = [
    ...group.querySelectorAll<HTMLButtonElement>('[role="radio"], [role="tab"]'),
  ].filter((item) => !item.disabled && item.getAttribute("aria-disabled") !== "true");
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !items.length) return;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (index + 1) % items.length
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? (index + items.length - 1) % items.length
            : null;
  if (next === null) return;
  event.preventDefault();
  items[next]!.focus();
  items[next]!.click();
}
