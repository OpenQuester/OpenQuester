import type { QuestionFile } from "@/game/protocol";
import { QuestionMediaItem } from "./media/QuestionMediaItem";

/**
 * Every file of a question at once, in order. Used by the showman's preview
 * and final questions; regular questions use the timeline in ContentStage.
 * Audio and video have no player controls: they play by themselves while
 * `playing` is true, so everybody sees and hears the same thing at the same
 * moment. Every file sits in a fixed frame, so nothing jumps when it loads.
 */
export function QuestionMedia({ files, playing }: { files: QuestionFile[]; playing: boolean }) {
  const sorted = [...files].filter((f) => f.file.link).sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      {sorted.map((f, i) => (
        <QuestionMediaItem key={`${f.file.md5}-${i}`} file={f} playing={playing} />
      ))}
    </div>
  );
}
