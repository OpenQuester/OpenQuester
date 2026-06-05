export enum PaginationOrder {
  ASC = "asc",
  DESC = "desc",
}

export interface PaginationOptsBase<T> {
  sortBy: T;
  order: PaginationOrder;
  limit: number;
  offset: number;
}
