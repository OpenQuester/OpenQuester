import { questionFormStyles } from "./questionFormStyles";
import { dialogStyles } from "@/ui/dialogStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import * as RD from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { CheckIcon, CloseIcon } from "@/ui/icons";
import type { QuestionPath } from "../packageOperations";
import type { QuestionFormState } from "./useQuestionForm";
export function QuestionHeader({ at, form }: { at: QuestionPath; form: QuestionFormState }) {
  const { t } = useTranslation();
  const { q, final, requestClose } = form;
  return (
    <header className={questionFormStyles.header}>
      <div className={layoutStyles.contentColumn}>
        <span className="truncate text-sm text-faint">
          {at.round.name || "—"} › {at.theme.name || "—"}
        </span>
        <RD.Title className={questionFormStyles.title}>
          {final ? t("editor.form.finalTitle") : t("editor.form.title", { price: q.price ?? "—" })}
        </RD.Title>
      </div>
      <RD.Description className="sr-only">{t("editor.form.description")}</RD.Description>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={requestClose}
        className={dialogStyles.formCloseButton}
      >
        <CloseIcon size={18} />
      </button>
    </header>
  );
}
export function QuestionFooter({
  form,
  onClose,
}: {
  form: QuestionFormState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { confirmClose, setConfirmClose, requestClose, save } = form;
  return (
    <footer className={questionFormStyles.footer}>
      {confirmClose ? (
        <>
          <span role="alert" className="flex-1 font-semibold text-warning">
            {t("editor.form.unsaved")}
          </span>
          <Button variant="danger" onClick={onClose}>
            {t("editor.form.discard")}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmClose(false)}>
            {t("editor.form.keepEditing")}
          </Button>
        </>
      ) : (
        <>
          <span className="hidden flex-1 text-sm text-faint sm:block">
            {t("editor.form.saveShortcut")}
          </span>
          <div className={questionFormStyles.actions}>
            <Button variant="ghost" size="lg" onClick={requestClose}>
              {t("editor.cancel")}
            </Button>
            <Button
              variant="accent"
              size="lg"
              onClick={save}
              icon={<CheckIcon size={18} />}
              data-testid="question-save"
            >
              {t("mediaEditor.saveQuestion")}
            </Button>
          </div>
        </>
      )}
    </footer>
  );
}
