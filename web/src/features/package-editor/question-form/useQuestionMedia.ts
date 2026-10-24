import { useContext, useRef, useState, type DragEvent } from "react";
import { StagedMediaContext } from "../packageEditorStore";
import { useOpenMedia } from "../media-editor/useStagedMedia";
import type { DraftMedia } from "../packageDraft";
import { usePackageEditor } from "../packageEditorStore";
export type QuestionMediaListProps = {
  label: string;
  help: string;
  files: DraftMedia[];
  /**
   * Changes the list from its latest value: files are read asynchronously, so
   * a removal or another drop during a read must not be overwritten.
   */
  onChange: (update: (files: DraftMedia[]) => DraftMedia[]) => void;
  onGeometryChange?: (index: number) => (() => void) | undefined;
};
/** Stage occurrence-specific changes; every async result reads the latest list. */
export function useQuestionMedia({ label, onChange, onGeometryChange }: QuestionMediaListProps) {
  const stored = usePackageEditor((s) => s.media);
  const staged = useContext(StagedMediaContext);
  const openMedia = useOpenMedia();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [undo, setUndo] = useState<{ run: () => void } | null>(null);

  const add = (list: FileList | File[]) =>
    openMedia([...list], label, ({ file }) => {
      const added = {
        md5: file.md5,
        type: file.type,
        displayTime: file.type === "image" ? 5000 : null,
      };
      onChange((current) => [...current, added]);
      setUndo({ run: () => onChange((current) => current.filter((f) => f !== added)) });
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
      onChange((current) =>
        current.map((f, j) =>
          j === i && f.md5 === m.md5 ? { ...f, md5: result.md5, type: result.type } : f,
        ),
      );
      const undoGeometry = geometryChanged ? onGeometryChange?.(i) : undefined;
      setUndo({
        run: () => {
          onChange((current) =>
            current.map((f, j) =>
              j === i && f.md5 === result.md5 ? { ...f, md5: m.md5, type: m.type } : f,
            ),
          );
          undoGeometry?.();
        },
      });
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
  const undoChange = () => {
    undo?.run();
    setUndo(null);
  };
  return {
    inputRef: input,
    over,
    setOver,
    hasUndo: !!undo,
    undoChange,
    add,
    onDrop,
    edit,
    canEdit,
    setDisplayTime,
  };
}
