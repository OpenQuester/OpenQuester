import { UserStatus } from "domain/enums/user/UserStatus";
import { UserType } from "domain/enums/user/UserType";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";

export type UserSortField =
  | "id"
  | "is_deleted"
  | "created_at"
  | "username"
  | "email"
  | "updated_at";

export interface UserPaginationOpts extends PaginationOptsBase<UserSortField> {
  search?: string;
  status?: UserStatus;
  userType?: UserType;
}
