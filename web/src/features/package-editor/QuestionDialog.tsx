import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import * as ops from "./packageOperations";
import { QuestionPreview } from "./QuestionPreview";
import { usePackageEditor } from "./packageEditorStore";
import { QuestionForm } from "./question-form/QuestionForm";
/**
 * The question form. Edits are staged and land as one undo step on Save;
 * closing with changes asks first. Full screen on phones.
 */
export function QuestionDialog() {
  const id = usePackageEditor((s) => s.editingId);
  const pkg = usePackageEditor((s) => s.pkg);
  const at = id ? ops.findQuestion(pkg, id) : null;
  const edit = usePackageEditor((s) => s.edit);
  const readOnly = usePackageEditor((s) => s.readOnly);
  if (!at) return null;
  if (readOnly) return <QuestionView at={at} onClose={() => edit(null)} />;
  return <QuestionForm key={at.question.id} at={at} onClose={() => edit(null)} />;
}

/** A published package's question, to look at only. */
function QuestionView({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${at.round.name || "—"} › ${at.theme.name || "—"}`}
      closeLabel={t("common.close")}
    >
      <div className="p-5" data-testid="question-view">
        <QuestionPreview question={at.question} final={at.round.type === "final"} />
      </div>
    </Dialog>
  );
}
