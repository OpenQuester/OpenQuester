import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { useGame, useGameState, useSession } from "../../GameContext";
import { actionStack } from "./actionDockStyles";

export function AnswerBox({ numeric = false }: { numeric?: boolean }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const session = useSession();
  const pending = useGameState((s) => s.pending?.action === "answer-submitted");
  const online = useGameState((s) => s.connection === "connected");
  const [text, setText] = useState("");
  const sent = pending || session.submittedAnswer != null;
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sent || !online || session.state.isPaused) return;
    connection.emit("answer-submitted", { answerText: text.trim() });
  }
  return (
    <form onSubmit={onSubmit} className={actionStack}>
      <div className="flex w-full gap-2">
        <label htmlFor="answer-text" className="sr-only">
          {t("dock.answering.typeLabel")}
        </label>
        <TextInput
          id="answer-text"
          value={text}
          autoFocus
          maxLength={255}
          inputMode={numeric ? "decimal" : undefined}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder={
            numeric ? t("dock.answering.numberPlaceholder") : t("dock.answering.typePlaceholder")
          }
          data-no-shortcuts
        />
        <Button type="submit" variant="accent" disabled={!text.trim() || sent}>
          {sent ? t("dock.answering.sent") : t("dock.answering.send")}
        </Button>
      </div>
    </form>
  );
}
