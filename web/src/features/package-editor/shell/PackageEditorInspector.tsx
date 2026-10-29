import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { CloseIcon, CopyIcon, EditIcon, MoveIcon, TrashIcon } from "@/ui/icons";
import type { QuestionPath } from "../packageOperations";
import { QuestionPreview } from "../QuestionPreview";
import type { BoardActions } from "../RoundBoard";
import { usePackageEditor } from "../packageEditorStore";
import { PackageEditorIconButton } from "./PackageEditorControls";
import type { useInspectorResize } from "./useInspectorResize";

export function PackageEditorInspector({
  selected,
  actions,
  resize,
}: {
  selected: QuestionPath;
  actions: BoardActions;
  resize: Omit<ReturnType<typeof useInspectorResize>, "containerRef" | "outlineRef" | "fits">;
}) {
  const { t } = useTranslation();
  const readOnly = usePackageEditor((s) => s.readOnly);
  const select = usePackageEditor((s) => s.select);
  const edit = usePackageEditor((s) => s.edit);
  const { handle, width, min, max, onPointerDown, onPointerMove, endPointer, onKeyDown } = resize;
  return (
    <div className="relative shrink-0" style={{ width }}>
      <div
        ref={handle}
        role="separator"
        aria-label={t("editor.inspector.resize")}
        aria-orientation="vertical"
        aria-controls="package-editor-inspector"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        className={packageEditorShellStyles.inspectorHandle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" className={packageEditorShellStyles.inspectorGrip} />
      </div>
      <aside
        id="package-editor-inspector"
        aria-label={t("editor.inspector.label")}
        className={packageEditorShellStyles.inspector}
        data-testid="inspector"
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-faint">
            {selected.round.name || "—"} › {selected.theme.name || "—"}
          </span>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => select(null)}
            className={packageEditorShellStyles.inspectorClose}
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <QuestionPreview question={selected.question} final={selected.round.type === "final"} />
        {!readOnly && (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              icon={<EditIcon size={18} />}
              onClick={() => edit(selected.question.id)}
            >
              {t("editor.actions.edit")}
            </Button>
            <div className="flex gap-2">
              <PackageEditorIconButton
                label={t("editor.actions.move")}
                onClick={() => actions.move(selected.question.id)}
              >
                <MoveIcon size={18} />
              </PackageEditorIconButton>
              <PackageEditorIconButton
                label={t("editor.actions.duplicate")}
                onClick={() => actions.duplicate(selected.question.id)}
              >
                <CopyIcon size={18} />
              </PackageEditorIconButton>
              <PackageEditorIconButton
                label={t("editor.actions.delete")}
                danger
                onClick={() => actions.remove(selected.question.id)}
              >
                <TrashIcon size={18} />
              </PackageEditorIconButton>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
