import { phaseOf } from "@/game/selectors";

import { useSession } from "../GameContext";
import { AllPlayReviewStage, AllPlayStakeStage } from "./AllPlayStages";
import { Board } from "./Board";
import { FinalAnswerStage, FinalBidStage, FinalReviewStage, FinalThemesStage } from "./FinalStages";
import { Podium } from "./Podium";
import { QuestionStage } from "./QuestionStage";
import { SecretStage, StakeStage } from "./SpecialStages";

export function Stage() {
  const session = useSession();
  switch (phaseOf(session)) {
    case "choosing":
      return <Board />;
    case "media":
    case "showing":
    case "answering":
    case "reveal":
      return <QuestionStage />;
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
      return <Podium />;
    default:
      return null;
  }
}
