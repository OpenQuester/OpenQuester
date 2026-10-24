import type { Player } from "@/game/protocol";

/** Retain occupied slots and show at most two empty seats before the overflow count. */
export function getLobbySeats(seated: Player[], maxPlayers: number) {
  const allSlots: (Player | null)[] = Array.from(
    { length: maxPlayers },
    (_, i) => seated.find((p) => p.slot === i) ?? null,
  );
  // Imported/rejoining players can lack a slot number and still need a card.
  for (const p of seated) if (!allSlots.includes(p)) allSlots[allSlots.indexOf(null)] = p;
  const emptyShown = 2;
  let emptySeen = 0;
  const slots = allSlots
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p != null || emptySeen++ < emptyShown);
  const hiddenEmpty =
    allSlots.filter((p) => p == null).length - slots.filter(({ p }) => p == null).length;

  return { slots, hiddenEmpty };
}
