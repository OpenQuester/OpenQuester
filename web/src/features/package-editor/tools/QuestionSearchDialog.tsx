import { packageEditorStyles } from "../packageEditorStyles";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { Dialog } from "@/ui/Dialog";
import { Label, TextInput } from "@/ui/Field";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";

/** Finds questions by text, answer or theme and opens one. */
export function QuestionSearchDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (roundId: string, questionId: string) => void;
}) {
  const { t } = useTranslation();
  const pkg = usePackageEditor((s) => s.pkg);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => ops.searchQuestions(pkg, query), [pkg, query]);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.tools.searchTitle")}
      closeLabel={t("common.close")}
    >
      <div className="flex min-h-0 flex-col gap-3 p-5">
        <Label htmlFor="ed-search" className="sr-only">
          {t("editor.tools.searchTitle")}
        </Label>
        <TextInput
          id="ed-search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("editor.tools.searchPlaceholder")}
        />
        {query.trim() && (
          <p className="m-0 text-sm text-muted">
            {t("editor.tools.searchCount", { count: hits.length })}
          </p>
        )}
        <ul className={packageEditorStyles.searchResults}>
          {hits.slice(0, 100).map((h) => (
            <li key={h.question.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(h.roundId, h.question.id);
                  onClose();
                }}
                className={packageEditorStyles.searchResult}
                data-testid="search-hit"
              >
                <span className="text-xs text-faint">
                  {h.roundName || "—"} › {h.themeName || "—"} ›{" "}
                  {h.question.price != null ? formatScore(h.question.price) : "?"}
                </span>
                <span className="line-clamp-2 [overflow-wrap:anywhere]">
                  {h.question.text || t("editor.tools.noText")}
                </span>
                {h.question.answerText && (
                  <span className="text-sm text-success">{h.question.answerText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
