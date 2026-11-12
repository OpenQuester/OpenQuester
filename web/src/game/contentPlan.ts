import {
  authoredContentGroups,
  type AuthoredContentSource,
  isVisual,
  VISUAL_QUEUE_THRESHOLD,
} from "./authoredContentGroups";
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

export function buildContentPlan(
  source: AuthoredContentSource<QuestionFile> & {
    playMediaSimultaneously?: boolean | null;
    answerDurationMs?: number | null;
  },
  defaults = { image: IMAGE_MS, audio: MEDIA_UNKNOWN_MS, video: MEDIA_UNKNOWN_MS },
): ContentPlan | null {
  const groups = authoredContentGroups(source);
  const captionMs =
    source.textOrder == null && source.text?.trim() && (source.answerDurationMs ?? 0) > 0
      ? (source.textDurationMs ?? textDuration(source.text))
      : 0;
  if (groups.length === 0 && !captionMs) return null;
  let cursor = 0;
  const steps: ContentStep[] = groups.map((group) => {
    const forceQueue =
      group.filter((entry) => "media" in entry && isVisual(entry.media)).length >=
      VISUAL_QUEUE_THRESHOLD;
    let offset = 0;
    let durationMs = 0;
    const items = group.map<ContentPlanItem>((entry) => {
      const { order } = entry;
      if ("text" in entry) {
        const duration = entry.durationMs ?? textDuration(entry.text);
        durationMs = Math.max(durationMs, duration);
        return {
          kind: "text",
          order,
          placement: entry.placement ?? "screen",
          durationMs: duration,
        };
      }

      const file = entry.media;
      const type = file.file.type;
      const background = type === "audio" && file.placement === "background";
      const duration =
        file.displayTime && file.displayTime > 0
          ? Math.min(ITEM_MAX_MS, file.displayTime)
          : defaults[type];
      const queued =
        !background &&
        (forceQueue || (source.playMediaSimultaneously === false && type !== "image"));
      const startOffsetMs = queued ? offset : 0;
      if (queued) offset += duration;
      if (!background || file.waitForFinish !== false) {
        durationMs = Math.max(durationMs, startOffsetMs + duration);
      }
      return {
        kind: "file",
        order,
        placement: background ? "background" : "screen",
        durationMs: duration,
        ...(startOffsetMs > 0 ? { startOffsetMs } : {}),
      };
    });
    const step = { startMs: cursor, durationMs, items };
    cursor += durationMs;
    return step;
  });
  if (captionMs > cursor) {
    steps.push({ startMs: cursor, durationMs: captionMs - cursor, items: [] });
    cursor = captionMs;
  }
  return { steps, totalMs: cursor };
}

export function buildAnswerContentPlan(source: Parameters<typeof buildContentPlan>[0]) {
  return buildContentPlan(source, { image: 5000, audio: 10000, video: 15000 });
}

export function itemStart(item: ContentPlanItem, stepStart: number) {
  return stepStart + (item.startOffsetMs ?? 0);
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
  screenIndex: number;
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
  let screenIndex = index;
  for (let i = index; i >= 0; i--) {
    const items = steps[i]!.items.filter((it) => it.placement === "screen");
    if (items.length > 0) {
      screen = items;
      screenStartMs = steps[i]!.startMs;
      screenIndex = i;
      break;
    }
  }
  const background: ContentPosition["background"] = [];
  for (let i = 0; i <= index; i++) {
    const step = steps[i]!;
    for (const item of step.items) {
      if (item.placement !== "background") continue;
      const startMs = itemStart(item, step.startMs);
      if (elapsedMs >= startMs && elapsedMs < startMs + item.durationMs)
        background.push({ item, startMs });
    }
  }
  return { index, screen, screenIndex, screenStartMs, background, done: elapsedMs >= plan.totalMs };
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
      const startMs = itemStart(item, step.startMs);
      consider(startMs);
      consider(startMs + item.durationMs);
    }
  }
  consider(plan.totalMs);
  return next;
}
