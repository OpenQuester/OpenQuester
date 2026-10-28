import { questionFormStyles } from "./questionFormStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { QuestionFieldsProps } from "./questionUpdates";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { PlusIcon, TrashIcon } from "@/ui/icons";
import { SingleMediaField } from "../media-editor/SingleMediaField";
import { newId } from "../packageDraft";
import { editChoiceText, selectChoice } from "./questionUpdates";
import { changeChoiceMedia, type ApplyMediaChange } from "./questionMediaHistory";
import { correctChoice } from "../choiceCorrectness";
export function QuestionChoiceFields({
  q,
  set,
  applyMedia,
}: QuestionFieldsProps & { applyMedia: ApplyMediaChange }) {
  const { t } = useTranslation();
  const correct = correctChoice(q);
  return (
    <fieldset className={layoutStyles.optionGroup} data-testid="choice-fields">
      <legend className="mb-1 text-[15px] font-semibold">{t("editor.form.options")}</legend>
      <span className="text-sm text-faint">{t("editor.form.optionsHelp")}</span>
      {q.options.map((o, i) => {
        const isCorrect = correct?.id === o.id;
        return (
          <div key={o.id} className={questionFormStyles.choice}>
            <div className="flex items-center gap-2">
              <span className="w-5 text-center font-semibold text-muted">
                {String.fromCharCode(65 + i)}
              </span>
              <TextInput
                aria-label={t("editor.form.option", { letter: String.fromCharCode(65 + i) })}
                value={o.text}
                onChange={(e) => set(editChoiceText(q, o.id, e.target.value))}
                className={isCorrect ? "border-success-line" : undefined}
              />
              <label
                className={cn(
                  questionFormStyles.correctChoice,
                  isCorrect
                    ? "border-success-line bg-success-surface text-success"
                    : "border-line-strong text-muted",
                )}
              >
                <input
                  type="radio"
                  name="qf-correct"
                  checked={isCorrect}
                  onChange={() => set(selectChoice(q, o.id))}
                />
                {t("editor.form.correct")}
              </label>
              <button
                type="button"
                aria-label={t("editor.form.removeOption", { letter: String.fromCharCode(65 + i) })}
                onClick={() =>
                  set({
                    options: q.options.filter((x) => x.id !== o.id),
                    ...(q.correctChoiceOptionId === o.id
                      ? {
                          correctChoiceOptionId: null,
                          ...(q.answerText === o.text ? { answerText: "" } : {}),
                        }
                      : {}),
                  })
                }
                className={questionFormStyles.choiceRemove}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            <SingleMediaField
              managedUndo
              label={t("mediaEditor.choiceImage", { letter: String.fromCharCode(65 + i) })}
              value={o.file}
              onChange={(file) => applyMedia(changeChoiceMedia(o.id, file))}
            />
          </div>
        );
      })}
      {q.options.length < 8 && (
        <Button
          id="qf-add-option"
          size="sm"
          className="self-start"
          icon={<PlusIcon size={16} />}
          onClick={() => set({ options: [...q.options, { id: newId(), text: "", file: null }] })}
        >
          {t("editor.form.addOption")}
        </Button>
      )}
    </fieldset>
  );
}
