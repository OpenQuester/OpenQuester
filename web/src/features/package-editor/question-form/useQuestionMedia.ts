import { useContext, useRef, useState, type DragEvent } from "react";
import { StagedMediaContext } from "../packageEditorStore";
import { useOpenMedia } from "../media-editor/useStagedMedia";
import type { DraftMedia } from "../packageDraft";
import { usePackageEditor } from "../packageEditorStore";
import { changeMedia, type ApplyMediaChange, type MediaSlot } from "./questionMediaHistory";
export type QuestionMediaListProps = {
  label: string;
  help: string;
  files: DraftMedia[];
  /**
   * Changes the list from its latest value: files are read asynchronously, so
   * a removal or another drop during a read must not be overwritten.
   */
  onChange: (update: (files: DraftMedia[]) => DraftMedia[]) => void;
  slot: MediaSlot;
  applyMedia: ApplyMediaChange;
};
/** Stage occurrence-specific changes; every async result reads the latest list. */
export function useQuestionMedia({ label, onChange, slot, applyMedia }: QuestionMediaListProps) {
  const stored = usePackageEditor((s) => s.media);
  const staged = useContext(StagedMediaContext);
  const openMedia = useOpenMedia();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | File[]) =>
    openMedia([...list], label, ({ file }) => {
      const added = {
        md5: file.md5,
        type: file.type,
        displayTime: file.type === "image" ? 5000 : null,
      };
      applyMedia(changeMedia(slot, { kind: "add", file: added }));
    });
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    setOver(false);
    void add(e.dataTransfer.files);
  };

  const edit = (m: DraftMedia, i: number) => {
    const file = staged?.get(m.md5) ?? stored.get(m.md5);
    if (!file) return;
    openMedia([file], label, ({ file: result, geometryChanged }) => {
      applyMedia(
        changeMedia(slot, {
          kind: "edit",
          index: i,
          original: m,
          file: { ...m, md5: result.md5, type: result.type },
          geometryChanged,
        }),
      );
    });
  };
  const setDisplayTime = (i: number, value: string) => {
    const s = Number(value.replace(",", "."));
    onChange((current) =>
      current.map((f, j) =>
        j === i
          ? {
              ...f,
              displayTime: value === "" || Number.isNaN(s) ? null : Math.round(s * 1000),
            }
          : f,
      ),
    );
  };
  const canEdit = (m: DraftMedia) => !!staged?.has(m.md5) || stored.has(m.md5);
  return {
    inputRef: input,
    over,
    setOver,
    remove: (index: number) => applyMedia(changeMedia(slot, { kind: "remove", index })),
    add,
    onDrop,
    edit,
    canEdit,
    setDisplayTime,
  };
}
