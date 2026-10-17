import { type PaginationOptsBase } from "domain/types/pagination/PaginationOpts";

export type GameSortField = "title" | "createdAt" | "isPrivate";

export interface GamePaginationOpts extends PaginationOptsBase<GameSortField> {
  createdAtMin?: Date;
  createdAtMax?: Date;
  isPrivate?: boolean;
  titlePrefix?: string;
}
