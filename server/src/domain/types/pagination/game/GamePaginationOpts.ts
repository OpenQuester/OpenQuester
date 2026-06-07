import { Game } from "domain/entities/game/Game";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";

export interface GamePaginationOpts extends PaginationOptsBase<Game> {
  createdAtMin?: Date;
  createdAtMax?: Date;
  isPrivate?: boolean;
  titlePrefix?: string;
}
