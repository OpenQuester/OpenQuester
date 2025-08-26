// Import shared backend types; keep runtime enums as value imports
import type {
  AdminDashboardData,
  AdminUserListData,
  PaginatedResult,
  PermissionDTO,
  AdminSystemHealthData as SystemHealthData,
  UserDTO,
} from "@server-dto";
// Runtime enums (value imports)
import {
  DashboardRecentTimeframe,
  PaginationOrder,
  UserType,
} from "@server-dto";

export { DashboardRecentTimeframe, PaginationOrder, UserType };
export type {
  AdminDashboardData,
  AdminUserListData,
  PaginatedResult,
  PermissionDTO,
  SystemHealthData,
  UserDTO,
};
