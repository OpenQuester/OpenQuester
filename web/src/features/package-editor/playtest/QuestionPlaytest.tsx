import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaFile } from "@/features/upload/types";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { questionMedia, type DraftQuestion } from "../packageDraft";
import {
  checkQuestion,
  type PackageIssueCode,
  type PackageValidationIssue,
} from "../validatePackage";
import { preparePreviewQuestion } from "./preparePreview";
import { PlaytestSession } from "./PlaytestSession";
import { initialPreview, previewMedia, previewQuestion, type PreviewNames } from "./previewModel";

type Issue = {
  code: PackageIssueCode | "reveal" | "stakeLimit" | "deviation";
  args?: PackageValidationIssue["args"];
};
const fieldFor: Partial<Record<Issue["code"], string>> = {
  questionEmpty: "#qf-text",
  noPrice: "#qf-price",
  priceRange: "#qf-price",
  missingMedia: '[data-testid="question-media-fields"] button',
  choiceOptions: '#qf-add-option, [data-testid="choice-fields"] input:not([type="radio"])',
  choiceEmptyOption: '[data-testid="choice-fields"] input:not([type="radio"])',
  secretPrices: "#qf-prices",
  numberAnswerMissing: "#qf-number",
  pointAnswerMissing: '[data-testid="point-picker"]',
  reveal: "#qf-reveal",
  stakeLimit: "#qf-max",
  deviation: "#qf-deviation, #qf-radius",
};

export function QuestionPlaytest({
  question,
  final,
  themeName,
  media,
  canSave,
  onFix,
}: {
  question: DraftQuestion;
  final: boolean;
  themeName: string;
  media: Map<string, MediaFile>;
  canSave: boolean;
  onFix: (selector: string) => void;
}) {
  const { t } = useTranslation();
  const issues = useMemo(() => {
    const list: Issue[] = [];
    checkQuestion(
      question,
      final,
      (severity, code, args) => {
        if (severity === "critical") list.push({ code, args });
      },
      (id) => {
        const file = media.get(id);
        return !!file && (file.bytes.byteLength > 0 || !!file.url);
      },
    );
    if (!canSave) list.push({ code: "reveal" });
    if (
      (final || question.type !== "choice") &&
      question.answerType !== "text" &&
      question.answerDeviation != null &&
      (!Number.isFinite(question.answerDeviation) || question.answerDeviation < 0)
    )
      list.push({ code: "deviation" });
    if (
      !final &&
      question.type === "stake" &&
      !question.forEveryone &&
      question.price != null &&
      question.maxPrice != null &&
      question.maxPrice < question.price
    )
      list.push({ code: "stakeLimit" });
    return list;
  }, [question, final, media, canSave]);
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState<{
    question: ReturnType<typeof previewQuestion>;
    initial: ReturnType<typeof initialPreview>;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  // Player names are part of the launched game. Keep its media resources and
  // state alive when only the surrounding UI language changes.
  const [names] = useState<PreviewNames>(() => ({
    showman: t("editor.playtest.showman"),
    players: [
      t("editor.playtest.player", { number: 1 }),
      t("editor.playtest.player", { number: 2 }),
      t("editor.playtest.player", { number: 3 }),
    ],
    spectator: t("editor.playtest.spectator"),
    round: t("editor.playtest.round"),
    final: t("editor.playtest.final"),
    theme: t("editor.playtest.theme"),
  }));

  useEffect(() => {
    if (issues.length) return;
    const controller = new AbortController();
    const needed = new Set(questionMedia(question).map((item) => item.md5));
    const available = new Map([...media].filter(([id]) => needed.has(id)));
    const resources = previewMedia(available);
    const q = previewQuestion(question, final, resources.links);
    void preparePreviewQuestion(q, controller.signal)
      .then((ready) => {
        if (!controller.signal.aborted)
          setPrepared({
            question: ready,
            initial: initialPreview(final, themeName || names.theme, ready, names),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      resources.dispose();
    };
  }, [attempt, final, issues.length, media, names, question, themeName]);

  if (issues.length)
    return (
      <div className="flex flex-col gap-3 p-5" role="alert">
        <p className="m-0 font-semibold">{t("editor.playtest.invalid")}</p>
        {issues.map((issue, index) => (
          <div key={`${issue.code}-${index}`} className="flex flex-wrap items-center gap-3">
            <span>
              {issue.code === "reveal"
                ? t("editor.form.revealRange")
                : issue.code === "stakeLimit"
                  ? t("editor.playtest.stakeLimit")
                  : issue.code === "deviation"
                    ? t("editor.playtest.deviation")
                    : t(`editor.issues.${issue.code}`, issue.args)}
            </span>
            <Button size="sm" onClick={() => onFix(fieldFor[issue.code] ?? "#qf-text")}>
              {t("editor.playtest.fix")}
            </Button>
          </div>
        ))}
      </div>
    );
  if (failed)
    return (
      <div className="flex flex-col items-start gap-3 p-5" role="alert">
        <p>{t("editor.playtest.mediaError")}</p>
        <Button
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          {t("editor.playtest.retry")}
        </Button>
      </div>
    );
  if (!prepared)
    return (
      <div className="p-5">
        <Spinner label={t("editor.playtest.loading")} />
      </div>
    );
  return (
    <PlaytestSession
      key={run}
      initial={prepared.initial}
      question={prepared.question}
      credits={{ authors: question.authors, sources: question.sources }}
      legacy={!!question.answerPoint && !question.answerPoint.imageAspectRatio}
      onRestart={() => setRun((n) => n + 1)}
    />
  );
}
