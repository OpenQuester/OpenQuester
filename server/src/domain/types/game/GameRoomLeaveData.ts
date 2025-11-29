import { BroadcastEvent } from "domain/types/service/ServiceResult";

export interface GameLobbyLeaveData {
  /** Emit leave event to lobby if true */
  emit: boolean;
  /** Data for event emit */
  data?: {
    userId: number;
    gameId: string;
  };
  /** Additional broadcasts to emit (e.g., answer-result from auto-skip) */
  broadcasts?: BroadcastEvent[];
}
