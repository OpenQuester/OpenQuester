// Central type-only barrel for DTO interfaces shared with external clients (admin panel).
// IMPORTANT: Export ONLY types (use `export type { ... }`) to avoid introducing runtime dependencies.
// Do NOT add classes, functions, or values here.

// Auth
export type { SessionDTO } from "./auth/SessionDTO";

// Permission / User
export type { PermissionDTO } from "./permission/PermissionDTO";
export type { SocketRedisUserUpdateDTO } from "./user/SocketRedisUserUpdateDTO";
export type { UpdateUserDTO } from "./user/UpdateUserDTO";
export type { UpdateUserInputDTO } from "./user/UpdateUserInputDTO";
export type { UserDTO } from "./user/UserDTO";
export type { UserInputDTO } from "./user/UserInputDTO";

// Package / Game related (add more as needed; keep strictly to pure interfaces/enums)
export type { GameImportDTO } from "./game/GameImportDTO";
export type { GameStateDTO } from "./game/state/GameStateDTO";
export type { GameStateTimerDTO } from "./game/state/GameStateTimerDTO";
export type { PackageAnswerDTO } from "./package/PackageAnswerDTO";
export type { PackageAnswerFileDTO } from "./package/PackageAnswerFileDTO";
export type { PackageDTO } from "./package/PackageDTO";
export type { PackageFileDTO } from "./package/PackageFileDTO";
export type { PackageQuestionDTO } from "./package/PackageQuestionDTO";
export type { PackageQuestionFileDTO } from "./package/PackageQuestionFileDTO";
export type { PackageRoundDTO } from "./package/PackageRoundDTO";
export type { PackageTagDTO } from "./package/PackageTagDTO";

// File usage
export type { FileUsageDTO } from "./file/FileUsageDTO";

// Pagination & Admin related
export { UserStatus } from "../../enums/user/UserStatus";
export type {
  AdminDashboardData,
  AdminPingData,
  AdminSystemHealthData,
  AdminUserListData,
  UsersStats,
} from "../../types/admin/AdminTypes";
export type { PaginatedResult } from "../../types/pagination/PaginatedResult";
export { PaginationOrder } from "../../types/pagination/PaginationOpts";

// Frontend-shared timeframe enum (not originally on server: adding for symmetry)
export enum DashboardRecentTimeframe {
  ONE_DAY = 1,
  SEVEN_DAYS = 7,
  FOURTEEN_DAYS = 14,
  THIRTY_ONE_DAYS = 31,
}
