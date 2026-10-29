import { serverNow } from "@/lib/clock";
import type { TimerLike } from "@/lib/timer";

import type { ContentPlan, ContentPlanItem, ContentStep, QuestionFile } from "./protocol";

/**
 * Question content timeline.
 *
 * The server builds the plan (see server QuestionContentPlanLogic) and runs it
 * on the phase timer, so the position on the timeline is that timer's elapsed
 * time. `buildContentPlan` mirrors the server for an older server that sends
 * no plan; real audio/video lengths are then unknown and use the defaults.
 */

const TEXT_MS_PER_CHAR = 50;
const TEXT_MIN_MS = 2_000;
const TEXT_MAX_MS = 15_000;
const IMAGE_MS = 5_000;
const MEDIA_UNKNOWN_MS = 20_000;
const ITEM_MAX_MS = 120_000;

export function textDuration(text: string): number {
  return Math.min(TEXT_MAX_MS, Math.max(TEXT_MIN_MS, text.length * TEXT_MS_PER_CHAR));
}

/** A legacy text step without an explicit order is the main question text. */
export function isMainTextItem(
  item: { kind: string; order: number },
  textOrder?: number | null,
  textItems?: readonly unknown[] | null,
): boolean {
  return (
    item.kind === "text" &&
    (textOrder != null ? item.order === textOrder : textOrder === undefined && !textItems?.length)
  );
}

export function buildContentPlan(source: {
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly { order: number; text: string }[] | null;
  files?: QuestionFile[] | null;
}): ContentPlan | null {
  type Entry = { item: ContentPlanItem; wait: boolean; key: number; tie: number };
  const entries: Entry[] = (source.files ?? []).map((f) => {
    const background = f.file.type === "audio" && f.placement === "background";
    const durationMs =
      f.displayTime && f.displayTime > 0
        ? Math.min(ITEM_MAX_MS, f.displayTime)
        : f.file.type === "image"
          ? IMAGE_MS
          : MEDIA_UNKNOWN_MS;
    return {
      item: {
        kind: "file",
        order: f.order,
        placement: background ? "background" : "screen",
        durationMs,
      },
      wait: f.waitForFinish ?? true,
      key: f.order,
      tie: 1,
    };
  });
  const text = source.text?.trim();
  if (text && source.textOrder != null) {
    entries.push({
      item: {
        kind: "text",
        order: source.textOrder,
        placement: "screen",
        durationMs: textDuration(text),
      },
      wait: true,
      key: source.textOrder,
      tie: 0,
    });
  }
  for (const item of source.textItems ?? []) {
    const value = item.text.trim();
    if (!value) continue;
    entries.push({
      item: {
        kind: "text",
        order: item.order,
        placement: "screen",
        durationMs: textDuration(value),
      },
      wait: true,
      key: item.order,
      tie: 0,
    });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.key - b.key || a.tie - b.tie);

  const steps: ContentStep[] = [];
  let current: Entry[] = [];
  let cursor = 0;
  const close = () => {
    if (current.length === 0) return;
    const blocking = current.filter((e) => e.wait || e.item.placement !== "background");
    const durationMs = Math.max(0, ...blocking.map((e) => e.item.durationMs));
    steps.push({ startMs: cursor, durationMs, items: current.map((e) => e.item) });
    cursor += durationMs;
    current = [];
  };
  for (const e of entries) {
    current.push(e);
    if (e.wait) close();
  }
  close();
  return { steps, totalMs: cursor };
}

/** Time already run on a server timer (frozen while paused). */
export function timerElapsed(
  timer: TimerLike | null | undefined,
  paused: boolean,
  now = serverNow(),
) {
  if (!timer) return 0;
  const since = Date.parse(timer.resumedAt ?? timer.startedAt);
  const running = paused || Number.isNaN(since) ? 0 : Math.max(0, now - since);
  return timer.elapsedMs + running;
}

export interface ContentPosition {
  /** Index of the current step. */
  index: number;
  /** Items on the stage: the current step's screen items, or the last step that had some. */
  screen: ContentPlanItem[];
  /** Start of the step the screen items belong to. */
  screenStartMs: number;
  /** Background sounds that are still playing, with their own start. */
  background: { item: ContentPlanItem; startMs: number }[];
  /** The whole timeline has played. */
  done: boolean;
}

export function positionAt(plan: ContentPlan, elapsedMs: number): ContentPosition {
  const steps = plan.steps;
  let index = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]!.startMs <= elapsedMs) index = i;
  }
  let screen: ContentPlanItem[] = [];
  let screenStartMs = 0;
  for (let i = index; i >= 0; i--) {
    const items = steps[i]!.items.filter((it) => it.placement === "screen");
    if (items.length > 0) {
      screen = items;
      screenStartMs = steps[i]!.startMs;
      break;
    }
  }
  const background: ContentPosition["background"] = [];
  for (let i = 0; i <= index; i++) {
    const step = steps[i]!;
    for (const item of step.items) {
      if (item.placement !== "background") continue;
      if (elapsedMs < step.startMs + item.durationMs)
        background.push({ item, startMs: step.startMs });
    }
  }
  return { index, screen, screenStartMs, background, done: elapsedMs >= plan.totalMs };
}

/** When the stage next changes, from `elapsedMs` (null when nothing more happens). */
export function nextChangeAt(plan: ContentPlan, elapsedMs: number): number | null {
  let next: number | null = null;
  const consider = (t: number) => {
    if (t > elapsedMs && (next == null || t < next)) next = t;
  };
  for (const step of plan.steps) {
    consider(step.startMs);
    for (const item of step.items) {
      if (item.placement === "background") consider(step.startMs + item.durationMs);
    }
  }
  consider(plan.totalMs);
  return next;
}
