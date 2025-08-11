import { UserStatus } from "domain/enums/user/UserStatus";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";
import { User } from "infrastructure/database/models/User";

export interface UserPaginationOpts extends PaginationOptsBase<User> {
  search?: string;
  status?: UserStatus;
}
