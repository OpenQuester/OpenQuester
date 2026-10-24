import { useTranslation } from "react-i18next";
import { useGameStore } from "@/game/store";
import { formatScore, formatSigned } from "@/lib/format";
import { Button } from "@/ui/Button";
import { useGame } from "../../GameContext";
import { centeredActions } from "./actionDockStyles";

export function JudgeExtras({ value, wrongCosts }: { value: number; wrongCosts: boolean }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const pending = useGameStore((s) => s.pending);
  const busy = pending?.action === "answer-result";
  const rule = (answerType: "correct" | "wrong", scoreResult: number) => () =>
    connection.emit("answer-result", { scoreResult, answerType });
  return (
    <div className={centeredActions} role="group" aria-label={t("judge.more")}>
      <Button
        size="sm"
        variant="ghost"
        className="flex-1 text-success"
        disabled={busy}
        onClick={rule("correct", value * 2)}
        aria-label={t("judge.correctDoubleLabel", { points: formatScore(value * 2) })}
        data-testid="judge-correct-double"
      >
        {t("judge.double", { points: formatSigned(value * 2) })}
      </Button>
      {wrongCosts && (
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-danger"
          disabled={busy}
          onClick={rule("wrong", -value * 2)}
          aria-label={t("judge.wrongDoubleLabel", { points: formatScore(value * 2) })}
          data-testid="judge-wrong-double"
        >
          {t("judge.double", { points: formatSigned(-value * 2) })}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="flex-1"
        disabled={busy}
        onClick={rule("correct", 0)}
        data-testid="judge-correct-zero"
      >
        {t("judge.correctZero")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="flex-1"
        disabled={busy}
        onClick={rule("wrong", 0)}
        data-testid="judge-wrong-zero"
      >
        {t("judge.wrongZero")}
      </Button>
    </div>
  );
}
