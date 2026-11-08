import type { QuestionFile } from "./protocol";

export const VISUAL_QUEUE_THRESHOLD = 5;

export interface AuthoredContentSource<T> {
  files?: readonly T[] | null;
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly { order: number; text: string }[] | null;
}

export function isVisual({ file }: Pick<QuestionFile, "file">) {
  return file.type === "image" || file.type === "video";
}

/** The same order and wait flags determine authored groups in the editor and game. */
export function authoredContentGroups<T extends Pick<QuestionFile, "order" | "waitForFinish">>(
  source: AuthoredContentSource<T>,
) {
  const texts = [
    ...(source.textOrder != null && source.text?.trim()
      ? [{ order: source.textOrder, text: source.text.trim() }]
      : []),
    ...(source.textItems ?? []).flatMap(({ order, text }) =>
      text.trim() ? [{ order, text: text.trim() }] : [],
    ),
  ];
  const entries = [
    ...texts,
    ...(source.files ?? []).map((media) => ({ order: media.order, media })),
  ].sort((a, b) => a.order - b.order);
  const groups: (typeof entries)[] = [];
  let group: typeof entries = [];
  for (const entry of entries) {
    group.push(entry);
    if (!("media" in entry) || entry.media.waitForFinish !== false) {
      groups.push(group);
      group = [];
    }
  }
  if (group.length) groups.push(group);
  return groups;
}
