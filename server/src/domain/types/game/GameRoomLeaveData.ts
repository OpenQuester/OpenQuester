import { Game } from "domain/entities/game/Game";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

export interface GameLobbyLeaveData {
  /** Emit leave event to lobby if true */
  emit: boolean;
  /** Data for event emit */
  data?: {
    userId: number;
    game: Game;
  };
  /** Additional broadcasts to emit (e.g., answer-result from auto-skip, final round events) */
  broadcasts?: BroadcastEvent[];
}
