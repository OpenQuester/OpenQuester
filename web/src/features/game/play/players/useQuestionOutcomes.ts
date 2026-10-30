import { useEffect, useState } from "react";
import { useSession } from "../../GameContext";
import { questionOutcomes } from "@/game/questionFeedback";

/** One expiry timer for the whole score bar, including after a return to the board. */
export function useQuestionOutcomes() {
  const session = useSession();
  const feedback = session.questionFeedback;
  const expiry = feedback?.expiresAt;
  const [expired, setExpired] = useState<number | null>(() =>
    expiry != null && Date.now() >= expiry ? expiry : null,
  );
  useEffect(() => {
    if (expiry == null) return;
    const timer = setTimeout(() => setExpired(expiry), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [expiry]);
  if (!feedback) return questionOutcomes(session.state);
  return {
    ...(expiry && expired !== expiry ? feedback.previous : {}),
    ...feedback.current,
  };
}
