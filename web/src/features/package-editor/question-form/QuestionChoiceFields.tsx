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
import { editChoiceText } from "./questionUpdates";
export function QuestionChoiceFields({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  const correct = q.answerText.trim();
  return (
    <fieldset className={layoutStyles.optionGroup}>
      <legend className="mb-1 text-[15px] font-semibold">{t("editor.form.options")}</legend>
      <span className="text-sm text-faint">{t("editor.form.optionsHelp")}</span>
      {q.options.map((o, i) => {
        const isCorrect = correct !== "" && o.text.trim() === correct;
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
                  onChange={() => set({ answerText: o.text })}
                />
                {t("editor.form.correct")}
              </label>
              <button
                type="button"
                aria-label={t("editor.form.removeOption", { letter: String.fromCharCode(65 + i) })}
                onClick={() => set({ options: q.options.filter((x) => x.id !== o.id) })}
                className={questionFormStyles.choiceRemove}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            <SingleMediaField
              label={t("mediaEditor.choiceImage", { letter: String.fromCharCode(65 + i) })}
              value={o.file}
              onChange={(file) =>
                set({ options: q.options.map((x) => (x.id === o.id ? { ...x, file } : x)) })
              }
            />
          </div>
        );
      })}
      {q.options.length < 8 && (
        <Button
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
