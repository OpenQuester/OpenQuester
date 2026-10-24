import { useMemo, useState } from "react";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";
import { parseQuestionText } from "../textImport";

export function useRoundPrices(roundId: string | null, onClose: () => void) {
  const apply = usePackageEditor((s) => s.apply);
  const [base, setBase] = useState("100");
  const [step, setStep] = useState("100");
  const firstPrice = Number(base);
  const priceStep = Number(step);
  const valid =
    Number.isInteger(firstPrice) &&
    firstPrice >= 0 &&
    Number.isInteger(priceStep) &&
    priceStep >= 0;
  const save = () => {
    if (!valid || !roundId) return;
    apply((p) => ops.setRoundPrices(p, roundId, firstPrice, priceStep), { key: "pricesSet" });
    onClose();
  };
  return { base, setBase, step, setStep, firstPrice, priceStep, valid, save };
}
export function usePastedQuestions(roundId: string | null, onClose: () => void) {
  const apply = usePackageEditor((s) => s.apply);
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuestionText(text), [text]);
  const questions = parsed.themes.reduce((n, th) => n + th.questions.length, 0);
  const save = () => {
    if (!roundId || questions === 0) return;
    apply((p) => ops.appendThemes(p, roundId, parsed.themes), {
      key: "questionsPasted",
    });
    setText("");
    onClose();
  };
  return { text, setText, parsed, questions, save };
}
