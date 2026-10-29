import type { GameSession } from "@/game/reducer";
import { finalBid, isEligible, myRole, phaseOf, stakeInfo } from "@/game/selectors";
import { PREVIEW_SHOWMAN } from "./previewModel";

/** Whether the preview is waiting for a different player perspective to act. */
export function needsPlayerPerspective(session: GameSession, perspective: number): boolean {
  const state = session.state;
  switch (phaseOf(session)) {
    case "answering":
      return session.submittedAnswer == null && state.answeringPlayer !== perspective;
    case "all_play_answering":
      return !state.allPlay?.entries.some(
        (entry) => entry.playerId === perspective && !entry.submitted,
      );
    case "all_play_bidding":
      return !state.allPlay?.entries.some(
        (entry) => entry.playerId === perspective && entry.stake == null,
      );
    case "final_answering":
      return (
        myRole(session, perspective) !== "player" ||
        !isEligible(session, perspective) ||
        finalBid(session, perspective) == null ||
        session.finalSubmitted.includes(perspective)
      );
    case "final_bidding":
      return (
        myRole(session, perspective) !== "player" ||
        !isEligible(session, perspective) ||
        finalBid(session, perspective) != null
      );
    case "stake_bidding":
      return stakeInfo(session)?.bidderId !== perspective;
    case "secret_transfer": {
      const secret = state.secretQuestionData;
      return secret?.priceSelection
        ? secret.priceSelection.playerId !== perspective
        : perspective !== PREVIEW_SHOWMAN && secret?.pickerPlayerId !== perspective;
    }
    case "final_elimination":
      return perspective !== PREVIEW_SHOWMAN && state.currentTurnPlayerId !== perspective;
    default:
      return false;
  }
}
