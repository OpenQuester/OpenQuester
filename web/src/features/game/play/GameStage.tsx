import { ScriptPriceStage } from "./ScriptPriceStage";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { phaseOf } from "@/game/selectors";

import { useSession } from "../GameContext";
import { AllPlayReviewStage, AllPlayStakeStage } from "./AllPlayStages";
import { GameBoard } from "./GameBoard";
import { FinalAnswerStage, FinalBidStage, FinalReviewStage, FinalThemesStage } from "./FinalStages";
import { GamePodium } from "./GamePodium";
import { QuestionStage } from "./QuestionStage";
import { SecretAwardStage, SecretStage, StakeStage } from "./SpecialStages";
import { QuestionPickTransition } from "./QuestionPickTransition";

export function GameStage() {
  return (
    <QuestionPickTransition>
      <GamePhaseStage />
    </QuestionPickTransition>
  );
}

function GamePhaseStage() {
  const session = useSession();
  const { t } = useTranslation();
  const awards = session.state.scriptView?.awards;
  if (!session.finished && session.state.questionState === "showing_answer" && awards?.length)
    return (
      <section className="mx-auto max-w-prose text-center" aria-live="polite">
        {awards.map((award) => (
          <p key={award.playerId}>
            {t("script.award", {
              name:
                session.players.find((player) => player.meta.id === award.playerId)?.meta
                  .username ?? t("chips.someone"),
              points: formatScore(award.points),
            })}
          </p>
        ))}
      </section>
    );
  if (session.state.scriptView?.waitingFor === "price")
    return (
      <ScriptPriceStage
        key={`${session.state.scriptView.questionId}:${session.state.scriptView.programCounter}`}
      />
    );
  switch (phaseOf(session)) {
    case "choosing":
      return <GameBoard />;
    case "media":
    case "showing":
    case "answering":
      return <QuestionStage />;
    case "reveal":
      if (session.state.secretAward) return <SecretAwardStage />;
      return session.state.currentRound?.type === "final" && !session.state.scriptView ? (
        <FinalReviewStage />
      ) : (
        <QuestionStage />
      );
    case "secret_transfer":
      return <SecretStage />;
    case "stake_bidding":
      return <StakeStage />;
    case "all_play_answering":
      return <QuestionStage />;
    case "all_play_bidding":
      return <AllPlayStakeStage />;
    case "all_play_reviewing":
      return <AllPlayReviewStage />;
    case "final_elimination":
      return <FinalThemesStage />;
    case "final_bidding":
      return <FinalBidStage />;
    case "final_answering":
      return <FinalAnswerStage />;
    case "final_reviewing":
      return <FinalReviewStage />;
    case "finished":
      return <GamePodium />;
    default:
      return null;
  }
}
