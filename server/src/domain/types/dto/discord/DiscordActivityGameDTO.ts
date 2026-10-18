import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";

/** The lobby that belongs to one Discord Activity instance (one voice channel call) */
export interface DiscordActivityGameDTO {
  /** Null until someone in the call picks a package */
  game: GameListItemDTO | null;
  /** Lobbies are private; everyone in the call gets the password to join */
  password: string | null;
  /** True when this request made the game, so the caller hosts it */
  created: boolean;
}
