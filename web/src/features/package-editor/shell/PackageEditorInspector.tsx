import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { CloseIcon, CopyIcon, EditIcon, MoveIcon, TrashIcon } from "@/ui/icons";
import type { QuestionPath } from "../packageOperations";
import { QuestionPreview } from "../QuestionPreview";
import type { BoardActions } from "../RoundBoard";
import { usePackageEditor } from "../packageEditorStore";
import { PackageEditorIconButton } from "./PackageEditorControls";

export function PackageEditorInspector({
  selected,
  actions,
}: {
  selected: QuestionPath;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const readOnly = usePackageEditor((s) => s.readOnly);
  const select = usePackageEditor((s) => s.select);
  const edit = usePackageEditor((s) => s.edit);
  return (
    <aside
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
        <div className="mt-auto flex gap-2 pt-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<EditIcon size={18} />}
            onClick={() => edit(selected.question.id)}
          >
            {t("editor.actions.edit")}
          </Button>
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
      )}
    </aside>
  );
}
