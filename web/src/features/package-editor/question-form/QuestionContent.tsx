import { questionFormStyles } from "./questionFormStyles";
import { Trans, useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { FieldError, inputClass, Label } from "@/ui/Field";
import { LinesField } from "../LinesField";
import { QUESTION_TYPES } from "../packageDraft";
import { MAX_PRICE } from "../validatePackage";
import { QuestionCheckbox, NumberField, OptionalTextField } from "./QuestionFields";
import { QuestionChoiceFields } from "./QuestionChoiceFields";
import { QuestionMediaList } from "./QuestionMediaList";
import { AnswerCheckFields, AnswerModeField, QuestionTypeSettings } from "./QuestionTypeSettings";
import { changeQuestionType } from "./questionUpdates";
import type { QuestionFieldsProps } from "./questionUpdates";
import type { QuestionFormState } from "./useQuestionForm";
export function QuestionContent({ form }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  const { q, set, setQ, final, onGeometryChange } = form;
  return (
    <>
      {!final && <QuestionTypePicker q={q} set={set} />}
      <div className={cn("grid gap-4", !final && "md:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]")}>
        {!final && (
          <NumberField
            id="qf-price"
            integer
            label={t("editor.form.price")}
            value={q.price}
            onChange={(price) => set({ price })}
            error={
              q.price == null
                ? t("editor.issues.noPrice")
                : q.price < 0 || q.price > MAX_PRICE
                  ? t("editor.issues.priceRange", { max: MAX_PRICE })
                  : undefined
            }
          />
        )}
        <OptionalTextField
          id="qf-comment"
          label={t("editor.form.comment")}
          help={t("editor.form.commentHelp")}
          value={q.questionComment}
          onChange={(value) => set({ questionComment: value })}
        />
      </div>
      <QuestionTypeSettings q={q} set={set} final={final} />
      <QuestionPromptFields q={q} set={set} final={final} />
      <div data-testid="question-media-fields">
        <QuestionMediaList
          label={t("editor.form.questionMedia")}
          help={t("editor.form.questionMediaHelp")}
          files={q.questionFiles}
          onGeometryChange={onGeometryChange}
          onChange={(update) =>
            setQ((prev) => ({ ...prev, questionFiles: update(prev.questionFiles) }))
          }
        />
      </div>
      {!q.text.trim() && q.questionFiles.length === 0 && (
        <FieldError>{t("editor.issues.questionEmpty")}</FieldError>
      )}
      {q.text.trim() && q.questionFiles.length > 0 && (
        <QuestionCheckbox
          checked={q.textPosition != null}
          onChange={(on) => set({ textPosition: on ? 0 : null })}
          label={t("editor.form.textFirst")}
        />
      )}
      {!final && q.type === "choice" && <QuestionChoiceFields q={q} set={set} />}
      <QuestionAnswerFields q={q} set={set} final={final} />
      <QuestionMediaList
        label={t("editor.form.answerMedia")}
        help={t("editor.form.answerMediaHelp")}
        files={q.answerFiles}
        onChange={(update) => setQ((prev) => ({ ...prev, answerFiles: update(prev.answerFiles) }))}
      />
      <QuestionTiming form={form} />
      <QuestionMetadataFields q={q} set={set} />
    </>
  );
}

function QuestionTypePicker({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[15px] font-semibold">{t("editor.form.type")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={q.type === type}
              onClick={() => set(changeQuestionType(q, type))}
              className={cn(
                questionFormStyles.questionType,
                q.type === type
                  ? "border-accent bg-accent-surface text-accent-soft"
                  : "border-line bg-surface-2 text-muted hover:border-line-strong",
              )}
            >
              <span
                className={cn("font-bold", q.type === type ? "text-accent-strong" : "text-text")}
              >
                {t(`questionTypes.${type}`)}
              </span>
              <span className="text-xs">{t(`editor.form.typeHelp.${type}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function QuestionPromptFields({ q, set, final }: QuestionFieldsProps & { final: boolean }) {
  const { t } = useTranslation();
  const hasAnswerMode = final || q.type !== "choice";
  return (
    <>
      <div
        className={cn("grid gap-4", hasAnswerMode && "md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]")}
      >
        <div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qf-text">{t("editor.form.text")}</Label>
            <textarea
              id="qf-text"
              autoFocus
              rows={3}
              value={q.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder={t("editor.form.textPlaceholder")}
              className={cn(inputClass, "min-h-24 resize-y py-3")}
            />
          </div>
        </div>
        {hasAnswerMode && <AnswerModeField q={q} set={set} />}
      </div>
      {hasAnswerMode && <AnswerCheckFields q={q} set={set} />}
    </>
  );
}

function QuestionAnswerFields({ q, set, final }: QuestionFieldsProps & { final: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {(final || q.type !== "choice") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <LinesField
            id="qf-answer"
            label={t("editor.form.answer")}
            help={
              <Trans
                i18nKey="editor.form.answerHelp"
                components={{ strong: <strong className="font-semibold" /> }}
              />
            }
            optional={false}
            value={[q.answerText, ...q.rightAnswers].filter(Boolean)}
            onChange={([answerText = "", ...rightAnswers]) => set({ answerText, rightAnswers })}
          />
          <OptionalTextField
            id="qf-hint"
            label={t("editor.form.hint")}
            help={t("editor.form.hintHelp")}
            value={q.answerHint}
            onChange={(value) => set({ answerHint: value })}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {!final && q.type === "choice" && (
          <LinesField
            id="qf-right"
            label={t("editor.form.rightAnswers")}
            help={
              <Trans
                i18nKey="editor.form.rightAnswersHelp"
                components={{ strong: <strong className="font-semibold" /> }}
              />
            }
            value={q.rightAnswers}
            onChange={(rightAnswers) => set({ rightAnswers })}
          />
        )}
        <LinesField
          id="qf-wrong"
          label={t("editor.form.wrongAnswers")}
          help={
            <Trans
              i18nKey="editor.form.wrongAnswersHelp"
              components={{ strong: <strong className="font-semibold" /> }}
            />
          }
          value={q.wrongAnswers}
          onChange={(wrongAnswers) => set({ wrongAnswers })}
        />
      </div>
    </>
  );
}

function QuestionMetadataFields({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <LinesField
          id="qf-authors"
          label={t("editor.form.authors")}
          value={q.authors}
          onChange={(authors) => set({ authors })}
        />
        <LinesField
          id="qf-sources"
          label={t("editor.form.sources")}
          help={t("editor.form.sourcesHelp")}
          value={q.sources}
          onChange={(sources) => set({ sources })}
        />
      </div>
    </>
  );
}

function QuestionTiming({ form }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span className={questionFormStyles.previewLabel}>{t("editor.form.timing")}</span>
      <Label htmlFor="qf-reveal">{t("editor.form.showAnswer")}</Label>
      <div className="flex items-center gap-2">
        <input
          id="qf-reveal"
          inputMode="decimal"
          value={form.revealText}
          disabled={form.q.answerFiles.length > 0}
          aria-invalid={!form.canSave}
          aria-describedby="qf-reveal-help"
          onChange={(e) => form.changeReveal(e.target.value)}
          className={cn(inputClass, "w-24")}
        />
        <span className="text-sm text-muted">{t("editor.form.secondsUnit")}</span>
      </div>
      <span id="qf-reveal-help" className="text-sm text-faint">
        {form.q.answerFiles.length
          ? t("editor.form.revealMediaHelp")
          : t("editor.form.revealRange")}
      </span>
      {!form.canSave && <FieldError>{t("editor.form.revealRange")}</FieldError>}
    </div>
  );
}
