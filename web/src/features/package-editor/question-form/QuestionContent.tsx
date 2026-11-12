import { answerFormat } from "@/game/answerFormat";
import { ImportWarnings } from "@/features/upload/ImportWarnings";
import { Button } from "@/ui/Button";
import { QuestionPreview } from "../QuestionPreview";
import { questionFormStyles } from "./questionFormStyles";
import { Trans, useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { FieldError, inputClass, Label } from "@/ui/Field";
import { LinesField } from "../LinesField";
import { VISUAL_QUEUE_THRESHOLD } from "@/game/authoredContentGroups";
import { questionGroupSizes } from "@/features/upload/contentLimits";
import { Toggle } from "@/ui/Toggle";
import { QUESTION_TYPES, toUploadQuestion } from "../packageDraft";
import { MAX_PRICE } from "../validatePackage";
import { NumberField, OptionalTextField } from "./QuestionFields";
import { QuestionChoiceFields } from "./QuestionChoiceFields";
import { QuestionMediaList } from "./QuestionMediaList";
import { AnswerCheckFields, AnswerModeField, QuestionTypeSettings } from "./QuestionTypeSettings";
import { changeQuestionType, convertImportedQuestionToSimple } from "./questionUpdates";
import type { QuestionFieldsProps } from "./questionUpdates";
import type { QuestionFormState } from "./useQuestionForm";
import { answerTimeline, questionSteps } from "./questionTimeline";
export function QuestionContent({ form }: { form: QuestionFormState }) {
  return form.q.script ? <ScriptContent form={form} /> : <StandardContent form={form} />;
}

function ScriptContent({ form: { q, set, final } }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4">
      <p className="m-0 text-muted">{t("script.preserved")}</p>
      {!final && (
        <NumberField
          id="qf-price"
          integer
          label={t("editor.form.price")}
          value={q.price}
          onChange={(price) => set({ price })}
        />
      )}
      <QuestionPreview question={q} final={final} />
    </div>
  );
}

function StandardContent({ form }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  const { q, set, final, applyMedia } = form;
  return (
    <>
      {!!q.compatibilityIssues?.length && (
        <div id="qf-compatibility" className="flex flex-col gap-2">
          <ImportWarnings warnings={q.compatibilityIssues} />
          <p className="m-0 text-sm text-warning">{t("editor.form.convertSimpleLoss")}</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm(t("editor.form.convertSimpleLoss")))
                set(convertImportedQuestionToSimple());
            }}
          >
            {t("editor.form.convertSimple")}
          </Button>
        </div>
      )}
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
      <NumberField
        id="qf-answer-duration"
        integer
        label={t("editor.form.answerDuration")}
        value={q.answerDurationMs == null ? null : q.answerDurationMs / 1000}
        onChange={(seconds) => set({ answerDurationMs: seconds == null ? null : seconds * 1000 })}
      />
      <p className="m-0 text-sm text-faint">{t("editor.form.answerDurationHelp")}</p>
      <NumberField
        id="qf-text-duration"
        label={t("editor.form.textDuration")}
        value={q.textDurationMs == null ? null : q.textDurationMs / 1000}
        onChange={(seconds) =>
          set({ textDurationMs: seconds == null ? null : Math.round(seconds * 1000) })
        }
      />
      <Toggle
        label={t("editor.timeline.waitForFinish")}
        checked={q.textWaitForFinish !== false}
        onChange={(textWaitForFinish) => set({ textWaitForFinish })}
      />
      <OptionalTextField
        id="qf-showman-comments"
        label={t("editor.form.showmanComments")}
        help={t("showman.onlyYou")}
        value={q.showmanComments ?? ""}
        onChange={(showmanComments) => set({ showmanComments })}
      />
      <QuestionPromptFields q={q} set={set} final={final} />
      <QuestionContentMedia form={form} />
      <hr className="m-0 border-0 border-t border-line" />
      {answerFormat(q) === "select" && (
        <QuestionChoiceFields q={q} set={set} applyMedia={applyMedia} />
      )}
      {q.secretRules?.outcome !== "award" && <QuestionAnswerFields q={q} set={set} final={final} />}
      <OptionalTextField
        id="qf-answer-explanation"
        label={t("editor.form.answerExplanation")}
        help={t("editor.form.answerExplanationHelp")}
        value={q.answerExplanation ?? ""}
        onChange={(answerExplanation) => set({ answerExplanation })}
      />
      <AnswerContentMedia form={form} />
      <hr className="m-0 border-0 border-t border-line" />
      <QuestionMetadataFields q={q} set={set} />
    </>
  );
}

function QuestionContentMedia({ form }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  const { q, set, setQ, final, applyMedia } = form;
  const question = toUploadQuestion(q, 0, final);
  const questionQueues = questionGroupSizes(question, "question").filter(
    (g) => g.visuals >= VISUAL_QUEUE_THRESHOLD,
  ).length;
  const answerQueues = questionGroupSizes(question, "answer").filter(
    (g) => g.visuals >= VISUAL_QUEUE_THRESHOLD,
  ).length;
  return (
    <>
      <div>
        <Toggle
          label={t("editor.form.playMediaSimultaneously")}
          checked={q.playMediaSimultaneously ?? true}
          onChange={(playMediaSimultaneously) => set({ playMediaSimultaneously })}
        />
        <p className="m-0 text-sm text-muted">{t("editor.form.playMediaSimultaneouslyHelp")}</p>
        {(questionQueues > 0 || answerQueues > 0) && (
          <p className="mt-1 mb-0 text-sm text-accent-strong">
            {t("editor.form.sequentialGroups", { question: questionQueues, answer: answerQueues })}
          </p>
        )}
      </div>
      <div data-testid="question-media-fields">
        <QuestionMediaList
          label={t("editor.form.questionMedia")}
          help={t("editor.form.questionMediaHelp")}
          files={q.questionFiles}
          slot="questionFiles"
          point={q.answerPoint}
          pointImageId={q.pointImageId}
          timeline={{ q, setQ, applyTimeline: form.applyTimeline }}
          applyMedia={applyMedia}
          onChange={(update) =>
            setQ((prev) => ({ ...prev, questionFiles: update(prev.questionFiles) }))
          }
        />
      </div>
      {q.secretRules?.outcome !== "award" &&
        !q.text.trim() &&
        !q.textItems?.some((item) => item.text.trim()) &&
        q.questionFiles.length === 0 && <FieldError>{t("editor.issues.questionEmpty")}</FieldError>}
    </>
  );
}

function AnswerContentMedia({ form }: { form: QuestionFormState }) {
  const { t } = useTranslation();
  const { q, setQ, applyMedia } = form;
  return (
    <QuestionMediaList
      label={t("editor.form.answerMedia")}
      help={t("editor.form.answerMediaHelp")}
      files={q.answerFiles}
      slot="answerFiles"
      timeline={{
        q: answerTimeline(q),
        setQ: (update) =>
          setQ((current) => {
            const next = typeof update === "function" ? update(answerTimeline(current)) : update;
            return {
              ...current,
              answerFiles: next.questionFiles,
              answerTextItems: next.textItems,
            };
          }),
        applyTimeline: (change) =>
          form.applyTimeline((current) => {
            const moved = change(answerTimeline(current));
            if (!moved) return null;
            return {
              question: {
                ...current,
                answerFiles: moved.question.questionFiles,
                answerTextItems: moved.question.textItems,
              },
              undo: (value) => {
                const restored = moved.undo(answerTimeline(value));
                return {
                  ...value,
                  answerFiles: restored.questionFiles,
                  answerTextItems: restored.textItems,
                };
              },
            };
          }),
      }}
      applyMedia={applyMedia}
      onChange={(update) => setQ((prev) => ({ ...prev, answerFiles: update(prev.answerFiles) }))}
    >
      <QuestionTiming form={form} />
    </QuestionMediaList>
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
  const mainIndex = questionSteps(q).findIndex((step) => step.kind === "main");
  const mainHelp =
    mainIndex < 0
      ? t("editor.timeline.captionHelp")
      : mainIndex === 0
        ? t("editor.timeline.mainFirstHelp")
        : t("editor.timeline.mainPositionHelp", { number: mainIndex + 1 });
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
            <span className="text-sm text-faint">{mainHelp}</span>
          </div>
        </div>
        {hasAnswerMode && <AnswerModeField q={q} set={set} />}
      </div>
      {hasAnswerMode && <AnswerCheckFields q={q} set={set} />}
    </>
  );
}

function QuestionAnswerFields({ q, set }: QuestionFieldsProps & { final: boolean }) {
  const { t } = useTranslation();
  const numeric = answerFormat(q) === "number";
  return (
    <>
      {!numeric && (
        <div className="grid gap-4 sm:grid-cols-2">
          {answerFormat(q) !== "select" ? (
            <LinesField
              key="answer"
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
          ) : (
            <LinesField
              key="right"
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
      )}
      <OptionalTextField
        id="qf-hint"
        label={t("editor.form.hint")}
        help={t("editor.form.hintHelp")}
        value={q.answerHint}
        onChange={(value) => set({ answerHint: value })}
      />
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
  const hasAnswerMedia = form.q.answerFiles.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="qf-reveal">{t("editor.form.showAnswer")}</Label>
      <div className="flex items-center gap-2">
        <input
          id="qf-reveal"
          inputMode="decimal"
          value={form.revealText}
          disabled={hasAnswerMedia}
          aria-invalid={!form.canSave}
          aria-describedby="qf-reveal-help"
          onChange={(e) => form.changeReveal(e.target.value)}
          className={cn(
            inputClass,
            "w-24 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-faint",
          )}
        />
        <span className="text-sm text-muted">{t("editor.form.secondsUnit")}</span>
      </div>
      {!form.canSave ? (
        <FieldError id="qf-reveal-help">{t("editor.form.revealRange")}</FieldError>
      ) : (
        <span
          id="qf-reveal-help"
          className={cn("text-sm", hasAnswerMedia ? "font-medium text-soft" : "text-faint")}
        >
          {hasAnswerMedia ? t("editor.form.revealMediaHelp") : t("editor.form.revealRange")}
        </span>
      )}
    </div>
  );
}
