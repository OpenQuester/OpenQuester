import { type ReactNode } from "react";
import type { QuestionFile } from "@/game/protocol";
import { isVisual } from "@/game/authoredContentGroups";
import { ContentControls } from "./ContentControls";
import { ExpandableVisual } from "./media/ExpandableVisual";
import { QuestionMediaItem } from "./media/QuestionMediaItem";
import { QuestionBody, type QuestionBodyProps } from "./question/QuestionBody";

/** Compatibility view for an already-running final from a server without a content plan. */
export function QuestionMedia({
  files,
  playing,
  suspended,
  replacePointImage,
  controls,
  history,
  ...body
}: Omit<QuestionBodyProps, "media" | "audio"> & {
  files: QuestionFile[];
  history?: ReactNode;
  playing: boolean;
  suspended?: boolean;
  replacePointImage?: { file: QuestionFile; view: ReactNode };
}) {
  const sorted = [...files].sort((a, b) => a.order - b.order);
  const visual = sorted.filter(isVisual);
  const audio = sorted.filter(({ file }) => file.type === "audio");
  const hasVolume = sorted.some(({ file }) => file.type !== "image");
  return (
    <QuestionBody
      {...body}
      media={
        visual.length ? (
          <div className="question-visuals">
            <div
              className="question-visual-grid"
              data-count={visual.length}
              data-testid="visual-grid"
            >
              {visual.map((file, index) =>
                file === replacePointImage?.file ? (
                  <div className="question-visual-cell" key={index}>
                    {replacePointImage.view}
                  </div>
                ) : (
                  <ExpandableVisual key={index} suspended={suspended}>
                    <QuestionMediaItem file={file} playing={playing} />
                  </ExpandableVisual>
                ),
              )}
            </div>
            {history}
          </div>
        ) : undefined
      }
      audio={
        audio.length
          ? audio.map((file, index) => (
              <QuestionMediaItem
                key={index}
                file={file}
                playing={playing}
                audioNumber={audio.length > 1 ? index + 1 : undefined}
              />
            ))
          : undefined
      }
      controls={controls ?? (hasVolume && <ContentControls volume />)}
    />
  );
}
