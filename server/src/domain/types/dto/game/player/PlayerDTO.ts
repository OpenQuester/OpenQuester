import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerMeta } from "domain/types/socket/game/PlayerMeta";

export interface PlayerDTO {
  meta: PlayerMeta;
  slot: number | null;
  role: PlayerRole;
  status: PlayerGameStatus;
  restrictionData: {
    muted: boolean;
    restricted: boolean;
    banned: boolean;
  };
  score: number;
  mediaDownloaded?: boolean;
}
