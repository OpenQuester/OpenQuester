import type { ContentPlan, QuestionFile } from "@/game/protocol";
import { itemStart } from "@/game/contentPlan";

export interface ScheduledMedia {
  id: string;
  file: QuestionFile;
  step: number;
  start: number;
  duration: number;
  background: boolean;
}

export function scheduledMedia(plan: ContentPlan, files: QuestionFile[]): ScheduledMedia[] {
  const byOrder = new Map<number, QuestionFile[]>();
  for (const file of files) {
    const matches = byOrder.get(file.order);
    if (matches) matches.push(file);
    else byOrder.set(file.order, [file]);
  }
  return plan.steps.flatMap((step, stepIndex) =>
    step.items.flatMap((item, index) => {
      const file = item.kind === "file" ? byOrder.get(item.order)?.shift() : undefined;
      return file
        ? [
            {
              id: `${stepIndex}:${index}`,
              file,
              step: stepIndex,
              start: itemStart(item, step.startMs),
              duration: item.durationMs,
              background: item.placement === "background",
            },
          ]
        : [];
    }),
  );
}
