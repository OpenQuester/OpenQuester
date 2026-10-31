import type { Player, StakeQuestionData } from "@/game/protocol";

/** Same turn/affordability rules as the server's BiddingTurn. */
export function nextAuctionTurn(stake: StakeQuestionData, players: Player[]) {
  const winner =
    stake.highestBid == null
      ? undefined
      : Object.entries(stake.bids).find(([, value]) => value === stake.highestBid)?.[0];
  const winnerId = winner == null ? null : Number(winner);
  const allIn = stake.biddingOrder.some((id) => {
    const player = players.find((item) => item.meta.id === id);
    return player && stake.bids[String(id)] === player.score;
  });
  const eligible = stake.biddingOrder.filter((id) => {
    const player = players.find((item) => item.meta.id === id);
    if (!player || stake.passedPlayers.includes(id) || stake.bids[String(id)] === player.score)
      return false;
    return stake.highestBid == null || player.score > stake.highestBid;
  });
  const complete =
    (stake.maxPrice != null && stake.highestBid === stake.maxPrice) ||
    eligible.length === 0 ||
    (eligible.length === 1 && eligible[0] === winnerId);
  const rotated = stake.biddingOrder
    .slice(stake.currentBidderIndex + 1)
    .concat(stake.biddingOrder.slice(0, stake.currentBidderIndex + 1));
  return {
    complete,
    next: complete ? null : (rotated.find((id) => eligible.includes(id)) ?? null),
    winner: winnerId,
    allIn,
  };
}
