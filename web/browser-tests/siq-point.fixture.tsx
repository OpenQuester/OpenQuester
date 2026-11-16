import { createRoot, type Root } from "react-dom/client";
import { PointPicker, type Spot } from "@/features/game/play/PointPicker";
import { parseSiq } from "@/features/upload/siq";
import { withPointImageDimensions } from "@/features/upload/pointImageDimensions";
import { fromUpload, toUpload } from "@/features/package-editor/packageDraft";
import { checkPreviewAnswer } from "@/features/package-editor/playtest/checkPreviewAnswer";
import { previewMedia, previewQuestion } from "@/features/package-editor/playtest/previewModel";
import { PointResults } from "@/features/game/play/question/PointResults";
import xml from "@/features/upload/fixtures/siq/point.xml?raw";
import wide from "@/features/upload/fixtures/siq/point-wide.png?url";
import other from "@/features/upload/fixtures/siq/point-other.png?url";

let lastPick: Spot | null = null;
let root: Root | undefined;
let dispose: (() => void) | undefined;
export async function mountImportedPoint(index: number, reveal: boolean) {
  root?.unmount();
  dispose?.();
  const [wideBytes, otherBytes] = await Promise.all(
    [wide, other].map(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())),
  );
  const parsed = await parseSiq({
    "content.xml": new TextEncoder().encode(xml),
    "Images/point-wide.png": wideBytes!,
    "Images/point-other.png": otherBytes!,
  });
  const draft = fromUpload(parsed.content);
  draft.rounds[0]!.themes[0]!.questions = [draft.rounds[0]!.themes[0]!.questions[index]!];
  const local = previewMedia(parsed.files);
  dispose = local.dispose;
  // Real decode through the publication preparation path; source aspect must survive.
  const measured = await withPointImageDimensions({ ...parsed, content: toUpload(draft) });
  const q = measured.content.rounds[0]!.themes[0]!.questions[0]!;
  const measuredDraft = fromUpload(measured.content).rounds[0]!.themes[0]!.questions[0]!;
  const question = previewQuestion(measuredDraft, false, local.links);
  const selected = question.questionFiles!.find((file) => file.order === question.pointImageOrder)!;
  if (!selected.file.link) throw new Error("Missing point fixture URL");
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  lastPick = null;
  root = createRoot(container);
  root.render(
    <div className="flex h-[70vh] w-full items-center justify-center bg-surface p-4">
      {reveal ? (
        <PointResults
          src={selected.file.link}
          target={q.answerPoint!}
          radius={q.answerDeviation}
          markers={[]}
        />
      ) : (
        <PointPicker
          src={selected.file.link}
          onPick={(spot) => {
            lastPick = spot;
          }}
        />
      )}
    </div>,
  );
  return {
    sourceAspect: q.answerPoint?.sourceGeometry?.aspectRatio,
    actualAspect: q.answerPoint?.imageAspectRatio,
    targetOrder: q.pointImageOrder,
    orders: q.questionFiles?.map((file) => file.order),
    verdict: checkPreviewAnswer(question, index === 2 ? "0.515,0.500" : "0.540,0.500"),
  };
}
export function pickedPoint() {
  return lastPick;
}
