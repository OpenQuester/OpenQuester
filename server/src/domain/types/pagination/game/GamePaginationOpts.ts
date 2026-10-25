import { type PaginationOptsBase } from "domain/types/pagination/PaginationOpts";

/** Game index fields a game list can be sorted by. */
export type GameSortField = "title" | "createdAt" | "isPrivate";
export type GameStatusFilter = "lobby" | "playing";

export interface GamePaginationOpts extends PaginationOptsBase<GameSortField> {
  createdAtMin?: Date;
  createdAtMax?: Date;
  isPrivate?: boolean;
  titlePrefix?: string;
  status?: GameStatusFilter;
}
