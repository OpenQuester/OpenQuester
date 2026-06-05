import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";

export enum GameEvent {
  CREATED = "created",
  CHANGED = "changed",
  DELETED = "deleted"
}

export interface GameEventDTO {
  event: GameEvent;
  data: Partial<GameListItemDTO>;
}
