import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import type { FinalRoundGameData } from "domain/types/finalround/FinalRoundInterfaces";

export function projectFinalRoundData(
  data: FinalRoundGameData | null | undefined,
  viewerId?: number
): FinalRoundGameData | null | undefined {
  if (!data) {
    return data;
  }
  let visibleBids: FinalRoundGameData["bids"] = {};
  if (data.phase === FinalRoundPhase.REVIEWING) {
    visibleBids = { ...data.bids };
  } else if (viewerId !== undefined && data.bids[viewerId] !== undefined) {
    visibleBids = { [viewerId]: data.bids[viewerId] };
  }

  return {
    ...data,
    submittedBidPlayerIds: Object.keys(data.bids).map(Number),
    bids: visibleBids,
    answers:
      data.phase === FinalRoundPhase.ANSWERING
        ? data.answers.map((answer) => ({ ...answer, answer: "", choiceOrder: undefined }))
        : data.answers
  };
}
