import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Ban, Users, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/api/admin";
import { UserDetailModal } from "@/components/users/UserDetailModal";
import { UsersCardsView } from "@/components/users/UsersCardsView";
import { UsersFiltersBar } from "@/components/users/UsersFiltersBar";
import { UsersLoadingSkeleton } from "@/components/users/UsersLoadingSkeleton";
import { UsersPagination } from "@/components/users/UsersPagination";
import { UsersStatsGrid } from "@/components/users/UsersStatsGrid";
import { UsersTableView } from "@/components/users/UsersTableView";
import { Permissions } from "@/constants/permissions";
import { QueryKeys } from "@/constants/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { toastMessageFromError, useToast } from "@/contexts/ToastContext";
import { useTableSort } from "@/hooks/useTableSort";
import {
  PaginationOrder,
  type AdminUserListData,
  type PaginatedResult,
  type UserDTO,
  type UserType,
} from "@/types/dto";
import type { UserStatus } from "@/types/userStatus";
import { userStatusOptions } from "@/types/userStatus";
import { userTypeOptions } from "@/types/userType";

const PAGE_LIMIT = 9;

enum FilterStatusLocal {
  ALL = "all",
}
enum FilterUserTypeLocal {
  ALL = "all",
}
enum ViewMode {
  TABLE = "table",
  CARDS = "cards",
}

export const UsersPage = () => {
  const {
    sortBy,
    order,
    handleSort: baseHandleSort,
  } = useTableSort({
    initialSortBy: "created_at",
    initialOrder: PaginationOrder.DESC,
  });
  const [limit] = useState<number>(PAGE_LIMIT);
  const [offset, setOffset] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<
    UserStatus | FilterStatusLocal
  >(FilterStatusLocal.ALL);
  const [filterUserType, setFilterUserType] = useState<
    UserType | FilterUserTypeLocal
  >(FilterUserTypeLocal.ALL);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CARDS);
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const { hasPermission } = useAuth();
  const { push: pushToast } = useToast();

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AdminUserListData>({
    queryKey: [
      QueryKeys.USERS,
      {
        sortBy,
        order,
        limit,
        offset,
        search: searchTerm.trim() || undefined,
        status:
          filterStatus !== FilterStatusLocal.ALL ? filterStatus : undefined,
        userType:
          filterUserType !== FilterUserTypeLocal.ALL
            ? filterUserType
            : undefined,
      },
    ],
    queryFn: () =>
      adminApi.getUsers({
        sortBy,
        order,
        limit,
        offset,
        search: searchTerm.trim() || undefined,
        status:
          filterStatus !== FilterStatusLocal.ALL ? filterStatus : undefined,
        userType:
          filterUserType !== FilterUserTypeLocal.ALL
            ? filterUserType
            : undefined,
      }),
    placeholderData: (prev) => prev, // treat previous data as placeholder to remove empty flashes
  });

  // Type assertion to ensure proper interface inheritance recognition
  const typedData = data as AdminUserListData & PaginatedResult<UserDTO[]>;

  // Derive pagination helpers (fallback if server does not send hasNext/limit)
  const total = typedData?.pageInfo?.total ?? 0;
  const effectiveLimit = limit; // Use our component's limit since pageInfo doesn't include limit
  const hasNext = offset + effectiveLimit < total;
  const hasPrev = offset > 0;

  // Keep offset in valid range when total shrinks
  useEffect(() => {
    if (
      typedData?.pageInfo?.total != null &&
      offset >= typedData.pageInfo.total
    ) {
      setOffset(0);
    }
  }, [typedData?.pageInfo?.total, offset]);

  // Reset offset on search/filter change
  useEffect(() => {
    setOffset(0);
  }, [searchTerm, filterStatus, filterUserType]);

  // Stable callback passed to isolated search input component
  const handleSearch = useCallback((val: string) => {
    setSearchTerm(val);
  }, []);

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.USERS] });
  };

  const handleSort = useCallback(
    (field: string) => {
      setOffset(0);
      baseHandleSort(field);
    },
    [baseHandleSort]
  );

  const handleBanUser = useCallback(
    async (userId: number) => {
      if (!hasPermission(Permissions.BAN_USERS)) return;
      try {
        await adminApi.banUser(userId);
        pushToast({ variant: "success", title: "User banned" });
        invalidateUsers();
      } catch (e) {
        console.error("Failed to ban user", e);
        pushToast({
          variant: "error",
          title: "Ban failed",
          description: toastMessageFromError(e),
        });
      }
    },
    [hasPermission, pushToast]
  );

  const handleUnbanUser = useCallback(
    async (userId: number) => {
      if (!hasPermission(Permissions.BAN_USERS)) return;
      try {
        await adminApi.unbanUser(userId);
        pushToast({ variant: "success", title: "User unbanned" });
        invalidateUsers();
      } catch (e) {
        console.error("Failed to unban user", e);
        pushToast({
          variant: "error",
          title: "Unban failed",
          description: toastMessageFromError(e),
        });
      }
    },
    [hasPermission, pushToast]
  );

  const handleDeleteUser = useCallback(
    async (userId: number) => {
      if (!hasPermission(Permissions.DELETE_ANOTHER_USER)) return;
      try {
        await adminApi.deleteUser(userId);
        pushToast({ variant: "success", title: "User deleted" });
        invalidateUsers();
      } catch (e) {
        console.error("Failed to delete user", e);
        pushToast({
          variant: "error",
          title: "Delete failed",
          description: toastMessageFromError(e),
        });
      }
    },
    [hasPermission, pushToast]
  );

  const handleRestoreUser = useCallback(
    async (userId: number) => {
      if (!hasPermission(Permissions.DELETE_ANOTHER_USER)) return;
      try {
        await adminApi.restoreUser(userId);
        pushToast({ variant: "success", title: "User restored" });
        invalidateUsers();
      } catch (e) {
        console.error("Failed to restore user", e);
        pushToast({
          variant: "error",
          title: "Restore failed",
          description: toastMessageFromError(e),
        });
      }
    },
    [hasPermission, pushToast]
  );

  const handleUserUpdated = useCallback((updatedUser: UserDTO) => {
    // Update the selectedUser state
    setSelectedUser(updatedUser);
    // Invalidate the users query to refetch the list
    invalidateUsers();
  }, []);

  // Server-driven users list (search & filter are UI-only placeholders until backend supports them)
  const users = typedData?.data ?? [];

  // Precompute stats (no hook to avoid conditional hook ordering issues)
  const statsCards = [
    {
      name: "Total Users",
      value: data?.stats?.total?.toLocaleString() || "0",
      icon: <Users className="h-6 w-6 text-white" />,
      colorClass: "bg-gradient-to-br from-blue-500 to-blue-600",
      description: "All registered",
    },
    {
      name: "Active Users",
      value: data?.stats?.active?.toLocaleString() || "0",
      icon: <Activity className="h-6 w-6 text-white" />,
      colorClass: "bg-gradient-to-br from-green-500 to-green-600",
      description: "Not banned",
    },
    {
      name: "Deleted Users",
      value: data?.stats?.deleted?.toLocaleString() || "0",
      icon: <UserX className="h-6 w-6 text-white" />,
      colorClass: "bg-gradient-to-br from-gray-500 to-gray-600",
      description: "Soft deleted",
    },
    {
      name: "Banned Users",
      value: data?.stats?.banned?.toLocaleString() || "0",
      icon: <Ban className="h-6 w-6 text-white" />,
      colorClass: "bg-gradient-to-br from-red-500 to-red-600",
      description: "Removed / banned",
    },
  ];

  // Removed early return so search input remains mounted; show skeletons inline below when initial load.

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">Users</h1>
          <p className="mt-2 text-secondaryText">
            Manage all users in the system
          </p>
        </div>
        <div className="card">
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center">
                <UserX className="h-5 w-5 text-error-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-error-800">
                  Failed to load users data
                </h3>
                <p className="text-sm text-error-600 mt-1">
                  Please check your connection and try again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">Users</h1>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <button
            onClick={() =>
              setViewMode(
                viewMode === ViewMode.CARDS ? ViewMode.TABLE : ViewMode.CARDS
              )
            }
            className="btn btn-secondary"
          >
            {viewMode === ViewMode.CARDS ? "Table View" : "Card View"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <UsersStatsGrid stats={statsCards} />

      {/* Filters and Search */}
      <UsersFiltersBar
        searchTerm={searchTerm}
        onSearch={handleSearch}
        filterStatus={filterStatus}
        onFilterChange={(v) =>
          setFilterStatus(v as UserStatus | FilterStatusLocal)
        }
        statusOptions={[
          { value: FilterStatusLocal.ALL, label: "All Users" },
          ...userStatusOptions.map((o) => ({ value: o.value, label: o.label })),
        ]}
        filterUserType={filterUserType}
        onUserTypeChange={(v) =>
          setFilterUserType(v as UserType | FilterUserTypeLocal)
        }
        userTypeOptions={[
          { value: FilterUserTypeLocal.ALL, label: "All Users" },
          ...userTypeOptions.map((o) => ({ value: o.value, label: o.label })),
        ]}
      />

      {/* Users List or Loading Skeleton */}
      {isLoading && !data && <UsersLoadingSkeleton />}
      {!isLoading &&
        (viewMode === ViewMode.CARDS ? (
          <UsersCardsView
            users={users}
            onView={setSelectedUser}
            onBan={handleBanUser}
            onUnban={handleUnbanUser}
            onDelete={handleDeleteUser}
            onRestore={handleRestoreUser}
          />
        ) : (
          <UsersTableView
            users={users}
            sortBy={sortBy}
            order={order}
            onSort={handleSort}
            hasPermission={hasPermission}
            onView={(u) => setSelectedUser(u)}
            onBan={handleBanUser}
            onUnban={handleUnbanUser}
            onDelete={handleDeleteUser}
            onRestore={handleRestoreUser}
          />
        ))}
      {/* Modals */}
      <UserDetailModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onUserUpdated={handleUserUpdated}
      />

      {/* Pagination */}
      {typedData?.pageInfo && (
        <UsersPagination
          total={typedData.pageInfo.total || 0}
          offset={offset}
          limit={effectiveLimit}
          count={users.length}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={() => setOffset(Math.max(0, offset - effectiveLimit))}
          onNext={() => setOffset(offset + effectiveLimit)}
        />
      )}
    </div>
  );
};
