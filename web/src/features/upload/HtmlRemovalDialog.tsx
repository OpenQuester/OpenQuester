import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { readPackageFile } from "./upload";
import type { HtmlRemovalReport } from "./htmlRemoval";

export function useHtmlRemovalConfirmation() {
  const [report, setReport] = useState<HtmlRemovalReport | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const controller = useRef<AbortController | null>(null);
  const settle = useCallback((answer: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setReport(null);
    resolve?.(answer);
    if (!answer && resolve)
      window.setTimeout(
        () => document.querySelector<HTMLElement>("[data-import-picker]")?.focus(),
        0,
      );
  }, []);
  useEffect(
    () => () => {
      controller.current?.abort();
      pending.current?.(false);
      pending.current = null;
    },
    [],
  );
  const begin = (file: File) => {
    controller.current?.abort();
    settle(false);
    const next = new AbortController();
    controller.current = next;
    const promise = readPackageFile(file, {
      signal: next.signal,
      confirmHtmlRemoval: (value) =>
        new Promise<boolean>((resolve) => {
          if (next.signal.aborted) {
            resolve(false);
            return;
          }
          pending.current = resolve;
          setReport(value);
        }),
    });
    return { promise, signal: next.signal };
  };
  return { report, settle, begin };
}

export function HtmlRemovalDialog({
  report,
  settle,
}: Pick<ReturnType<typeof useHtmlRemovalConfirmation>, "report" | "settle">) {
  const { t } = useTranslation();
  const all = report != null && report.questions.length === report.totalQuestions;
  return (
    <Dialog
      open={report !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={t("upload.htmlRemoval.title")}
      closeLabel={t("common.close")}
    >
      {report && (
        <div className="flex flex-col gap-4 p-5">
          <p className="m-0">
            {t("upload.htmlRemoval.explanation", { count: report.questions.length })}
          </p>
          {all && (
            <p role="alert" className="m-0 text-danger">
              {t("upload.htmlRemoval.all")}
            </p>
          )}
          <ul className="m-0 max-h-64 overflow-y-auto pl-5">
            {report.questions.map((q) => (
              <li
                className="[overflow-wrap:anywhere]"
                key={`${q.roundIndex}-${q.themeIndex}-${q.questionIndex}`}
              >
                {t("upload.htmlRemoval.item", {
                  round: q.round,
                  theme: q.theme,
                  number: q.questionIndex + 1,
                  price: q.price || "—",
                })}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => settle(false)}>{t("upload.htmlRemoval.cancel")}</Button>
            <Button variant="accent" disabled={all} onClick={() => settle(true)}>
              {t("upload.htmlRemoval.confirm")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
