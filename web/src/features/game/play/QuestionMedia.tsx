import { Fragment, type ReactNode } from "react";
import type { QuestionFile } from "@/game/protocol";
import { QuestionMediaItem } from "./media/QuestionMediaItem";

/**
 * Every file of a question at once, in order. Used by the showman's preview
 * and final questions; regular questions use the timeline in ContentStage.
 * Audio and video have no player controls: they play by themselves while
 * `playing` is true, so everybody sees and hears the same thing at the same
 * moment. Every file sits in a fixed frame, so nothing jumps when it loads.
 */
export function QuestionMedia({
  files,
  playing,
  replacePointImage,
}: {
  files: QuestionFile[];
  playing: boolean;
  replacePointImage?: { file: QuestionFile; view: ReactNode };
}) {
  const sorted = [...files].filter((f) => f.file.link).sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  const replacementIndex = replacePointImage ? sorted.indexOf(replacePointImage.file) : -1;
  const occurrences = new Map<string, number>();
  return (
    <div className="flex w-full flex-col gap-3">
      {sorted.map((f, index) => {
        const identity = `${f.file.md5}-${f.order}`;
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        return (
          <Fragment key={`${identity}-${occurrence}`}>
            {index === replacementIndex && replacePointImage ? (
              replacePointImage.view
            ) : (
              <QuestionMediaItem file={f} playing={playing} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
