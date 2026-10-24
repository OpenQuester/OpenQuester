import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { UndoIcon, RedoIcon } from "@/ui/icons";

export function HistoryButtons({
  canUndo,
  canRedo,
  undo,
  redo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <Button
        className="w-11 shrink-0 px-0"
        disabled={!canUndo}
        onClick={undo}
        aria-label={t("mediaEditor.undo")}
        title={`${t("mediaEditor.undo")} (Ctrl / ⌘ + Z)`}
        aria-keyshortcuts="Control+z Meta+z"
      >
        <UndoIcon size={20} />
      </Button>
      <Button
        className="w-11 shrink-0 px-0"
        disabled={!canRedo}
        onClick={redo}
        aria-label={t("mediaEditor.redo")}
        title={`${t("mediaEditor.redo")} (Ctrl / ⌘ + Shift + Z)`}
        aria-keyshortcuts="Control+Shift+z Meta+Shift+z"
      >
        <RedoIcon size={20} />
      </Button>
    </div>
  );
}
