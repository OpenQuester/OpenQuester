import type { Player } from "@/game/protocol";

export function getLobbySeats(seated: Player[], maxPlayers: number) {
  const allSlots: (Player | null)[] = Array.from(
    { length: maxPlayers },
    (_, i) => seated.find((p) => p.slot === i) ?? null,
  );
  // Imported/rejoining players can lack a slot number and still need a card.
  for (const player of seated) {
    if (allSlots.includes(player)) continue;
    const free = allSlots.indexOf(null);
    if (free < 0) allSlots.push(player);
    else allSlots[free] = player;
  }
  return allSlots.map((p, index) => ({ p, index }));
}
