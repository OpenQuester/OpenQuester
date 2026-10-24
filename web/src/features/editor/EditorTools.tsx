import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { inputClass, Label, TextInput } from "@/ui/Field";

import * as ops from "./ops";
import { useEditor } from "./store";
import { parseQuestionText } from "./textImport";

/** Every question of a round gets a price: the first `base`, then + `step`. */
export function RoundPricesDialog({
  roundId,
  onClose,
}: {
  roundId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const [base, setBase] = useState("100");
  const [step, setStep] = useState("100");
  const b = Number(base);
  const st = Number(step);
  const valid = Number.isInteger(b) && b >= 0 && Number.isInteger(st) && st >= 0;
  return (
    <Dialog
      open={roundId != null}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.tools.pricesTitle")}
      description={t("editor.tools.pricesHelp")}
      closeLabel={t("common.close")}
    >
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || !roundId) return;
          apply((p) => ops.setRoundPrices(p, roundId, b, st), { key: "pricesSet" });
          onClose();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-base">{t("editor.tools.firstPrice")}</Label>
            <TextInput
              id="rp-base"
              inputMode="numeric"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-step">{t("editor.tools.step")}</Label>
            <TextInput
              id="rp-step"
              inputMode="numeric"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            />
          </div>
        </div>
        {valid && (
          <p className="m-0 text-sm text-muted">
            {t("editor.tools.pricesPreview", {
              prices: [0, 1, 2, 3, 4].map((i) => formatScore(b + i * st)).join(", "),
            })}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={!valid}>
            {t("editor.tools.applyPrices")}
          </Button>
          <Button size="lg" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Paste questions as text; each block becomes a theme at the end of the round. */
export function PasteQuestionsDialog({
  roundId,
  onClose,
}: {
  roundId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuestionText(text), [text]);
  const questions = parsed.themes.reduce((n, th) => n + th.questions.length, 0);
  return (
    <Dialog
      open={roundId != null}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.tools.pasteTitle")}
      description={t("editor.tools.pasteHelp")}
      closeLabel={t("common.close")}
    >
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!roundId || questions === 0) return;
          apply((p) => ops.appendThemes(p, roundId, parsed.themes), {
            key: "questionsPasted",
          });
          setText("");
          onClose();
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

/** Finds questions by text, answer or theme and opens one. */
export function SearchDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (roundId: string, questionId: string) => void;
}) {
  const { t } = useTranslation();
  const pkg = useEditor((s) => s.pkg);
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
        <ul className="m-0 flex max-h-[50dvh] list-none flex-col gap-1 overflow-y-auto p-0">
          {hits.slice(0, 100).map((h) => (
            <li key={h.question.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(h.roundId, h.question.id);
                  onClose();
                }}
                className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left hover:bg-surface-2"
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
