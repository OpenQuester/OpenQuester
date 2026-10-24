import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { inputClass, Label } from "@/ui/Field";
import { usePastedQuestions } from "./useRoundTools";

/** Paste questions as text; each block becomes a theme at the end of the round. */
export function PasteQuestionsDialog({
  roundId,
  onClose,
}: {
  roundId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { text, setText, parsed, questions, save } = usePastedQuestions(roundId, onClose);
  return (
    <Dialog
      open={roundId != null}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.tools.pasteTitle")}
      description={t("editor.tools.pasteHelp")}
      closeLabel={t("common.close")}
    >
      <form
        className={layoutStyles.cardBody}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Label htmlFor="pq-text">{t("editor.tools.pasteLabel")}</Label>
        <textarea
          id="pq-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("editor.tools.pastePlaceholder")}
          className={cn(inputClass, "resize-y py-3 font-mono text-sm")}
          data-testid="paste-text"
        />
        <p className="m-0 text-sm text-muted" data-testid="paste-summary">
          {t("editor.tools.pasteSummary", { themes: parsed.themes.length, questions })}
          {parsed.missingAnswers > 0 &&
            ` ${t("editor.tools.pasteMissing", { count: parsed.missingAnswers })}`}
        </p>
        <div className="flex gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={questions === 0}>
            {t("editor.tools.pasteAdd")}
          </Button>
          <Button size="lg" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
