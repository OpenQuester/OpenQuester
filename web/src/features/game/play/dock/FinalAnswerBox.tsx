import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { useTimedAnswer } from "./useTimedAnswer";

export function FinalAnswerBox({
  event = "final-answer-submit",
  numeric = false,
}: {
  event?: "final-answer-submit" | "all-play-answer";
  numeric?: boolean;
}) {
  const { t } = useTranslation();
  const { text, setText, submit, disabled } = useTimedAnswer(event);

  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) submit(text);
      }}
    >
      <label htmlFor="final-answer" className="sr-only">
        {event === "all-play-answer" ? t("dock.answering.typeLabel") : t("dock.final.answerLabel")}
      </label>
      <TextInput
        id="final-answer"
        value={text}
        autoFocus
        inputMode={numeric ? "decimal" : undefined}
        maxLength={255}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("dock.final.answerPlaceholder")}
        data-no-shortcuts
      />
      <Button
        type="submit"
        variant="accent"
        disabled={!text.trim() || disabled}
        data-testid="final-submit"
      >
        {t("dock.final.submit")}
      </Button>
    </form>
  );
}
