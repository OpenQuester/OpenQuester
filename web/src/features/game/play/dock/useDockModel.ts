import { useTranslation } from "react-i18next";
import { type GameSession } from "@/game/reducer";
import { useGameState } from "@/features/game/GameContext";
import { useSecretTarget } from "../useSecretTarget";
import { useBuzzer } from "../useBuzzer";
import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";
import { choosingModel, mediaModel, finishedModel } from "./roundModels";
import { showingModel, answeringModel, revealModel } from "./questionModels";
import { secretModel, stakeModel } from "./specialModels";
import { allPlayStakeModel, allPlayAnswerModel, allPlayReviewModel } from "./allPlayModels";
import {
  finalEliminationModel,
  finalBidModel,
  finalAnswerModel,
  finalReviewModel,
} from "./finalModels";
import { findPlayer, myRole, phaseOf, questionValue, type DisabledReason } from "@/game/selectors";

export function useDockModel(session: GameSession, myId: number): ActionDockModel {
  const { t } = useTranslation();
  const pending = useGameState((s) => s.pending);
  const [secretTarget] = useSecretTarget();
  const buzzer = useBuzzer(session, myId);
  const phase = phaseOf(session);
  const role = myRole(session, myId);
  const name = (id: number | null | undefined) =>
    findPlayer(session, id)?.meta.username ?? t("chips.someone");
  const value = questionValue(session);
  const sending = (action: string) => pending?.action === action;
  const reason = (r: DisabledReason) => t(`reasons.${r}`);

  const ctx: ActionDockContext = {
    t,
    session,
    myId,
    secretTarget,
    role,
    name,
    value,
    sending,
    reason,
    buzzer,
  };
  switch (phase) {
    case "choosing":
      return choosingModel(ctx);
    case "media":
      return mediaModel(ctx);
    case "showing":
      return showingModel(ctx);
    case "answering":
      return answeringModel(ctx);
    case "reveal":
      return revealModel(ctx);
    case "secret_transfer":
      return secretModel(ctx);
    case "stake_bidding":
      return stakeModel(ctx);
    case "all_play_bidding":
      return allPlayStakeModel(ctx);
    case "all_play_answering":
      return allPlayAnswerModel(ctx);
    case "all_play_reviewing":
      return allPlayReviewModel(ctx);
    case "final_elimination":
      return finalEliminationModel(ctx);
    case "final_bidding":
      return finalBidModel(ctx);
    case "final_answering":
      return finalAnswerModel(ctx);
    case "final_reviewing":
      return finalReviewModel(ctx);
    case "finished":
      return finishedModel(ctx);
    default:
      return { status: "", action: null, next: "" };
  }
}
