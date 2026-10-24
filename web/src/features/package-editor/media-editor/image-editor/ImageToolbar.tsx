import { mediaEditorStyles } from "../mediaEditorStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { RefObject } from "react";
import { imageTools, type ImageTool } from "../mediaEdits";
import { HistoryButtons } from "../HistoryButtons";
export function ImageToolbar({
  toolButtons,
  tool,
  blurSupported,
  chooseTool,
  canUndo,
  canRedo,
  undo,
  redo,
}: {
  toolButtons: RefObject<(HTMLButtonElement | null)[]>;
  tool: ImageTool;
  blurSupported: boolean;
  chooseTool: (tool: ImageTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={mediaEditorStyles.toolbar}
      role="toolbar"
      aria-label={t("mediaEditor.imageTools")}
    >
      {imageTools.map((name, index) => (
        <Button
          key={name}
          ref={(el) => {
            toolButtons.current[index] = el;
          }}
          className="flex-col gap-0.5 px-3 py-1.5"
          disabled={name === "blur" && !blurSupported}
          aria-pressed={tool === name}
          aria-keyshortcuts={String(index + 1)}
          title={`${t(`mediaEditor.${name}`)} (${index + 1})`}
          variant={tool === name ? "accent" : "ghost"}
          onClick={() => chooseTool(name)}
        >
          <kbd aria-hidden="true" className={mediaEditorStyles.toolShortcut}>
            {index + 1}
          </kbd>
          <span>{t(`mediaEditor.${name}`)}</span>
        </Button>
      ))}
      <HistoryButtons canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} />
    </div>
  );
}
