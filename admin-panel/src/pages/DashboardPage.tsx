import { adminApi } from "@/api/admin";
import { ErrorNotice } from "@/components/common/ErrorNotice";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { StatCard } from "@/components/common/StatCard";
import { InlineSpinner } from "@/components/dashboard/InlineSpinner";
import { TimeframeSelector } from "@/components/dashboard/TimeframeSelector";
import { UserDetailModal } from "@/components/users/UserDetailModal";
import { UsersPagination } from "@/components/users/UsersPagination";
import { UsersTableView } from "@/components/users/UsersTableView";
import { Permissions } from "@/constants/permissions";
import { QueryKeys } from "@/constants/queryKeys";
import { StatGradients } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { toastMessageFromError, useToast } from "@/contexts/ToastContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useSystemHealthData } from "@/hooks/useSystemHealthData";
import { useTableSort } from "@/hooks/useTableSort";
import {
  DashboardRecentTimeframe,
  PaginationOrder,
  type UserDTO,
} from "@/types/dto";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Database, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const TIMEFRAME_OPTIONS: DashboardRecentTimeframe[] = [
  DashboardRecentTimeframe.ONE_DAY,
  DashboardRecentTimeframe.SEVEN_DAYS,
  DashboardRecentTimeframe.FOURTEEN_DAYS,
  DashboardRecentTimeframe.THIRTY_ONE_DAYS,
];

const DashboardLoading = () => (
  <div className="space-y-6 animate-in fade-in">
    <div className="animate-pulse">
      <div className="h-8 bg-hover rounded w-48 mb-2"></div>
      <div className="h-4 bg-hover rounded w-64"></div>
    </div>
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
    <div className="card animate-pulse">
      <div className="p-6">
        <div className="h-6 bg-hover rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-hover rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-hover rounded w-24 mb-1"></div>
                <div className="h-3 bg-hover rounded w-32"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const DashboardPage = () => {
  const [timeframe, setTimeframe] = useState<DashboardRecentTimeframe>(
    DashboardRecentTimeframe.SEVEN_DAYS
  );
  const {
    data: dashboardData,
    isLoading,
    error,
    isFetching,
  } = useDashboardData(timeframe);
  const { data: systemHealthData, isFetching: isHealthFetching } =
    useSystemHealthData();
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  // Local table state (client-side since dashboard recent users small set)
  const {
    sortBy,
    order,
    handleSort: baseHandleSort,
  } = useTableSort({
    initialSortBy: "created_at",
    initialOrder: PaginationOrder.DESC,
  });
  const [limit] = useState<number>(15);
  const [offset, setOffset] = useState<number>(0);
  const recentUsersAll = dashboardData?.recentUsers || [];

  // Apply sorting & pagination client-side
  const sortedUsers = useMemo(() => {
    const copy = [...recentUsersAll];
    const dir = order === PaginationOrder.ASC ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortBy) {
        case "created_at":
        case "createdAt":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        case "id":
          return (a.id - b.id) * dir;
        default: {
          const avRaw = a[sortBy as keyof UserDTO];
          const bvRaw = b[sortBy as keyof UserDTO];
          if (avRaw == null && bvRaw == null) return 0;
          if (avRaw == null) return 1; // push undefined to end in both orders for stability
          if (bvRaw == null) return -1;
          const av =
            typeof avRaw === "number" ? avRaw : String(avRaw).toLowerCase();
          const bv =
            typeof bvRaw === "number" ? bvRaw : String(bvRaw).toLowerCase();
          if (av === bv) return 0;
          return av > bv ? dir : -dir;
        }
      }
    });
    return copy;
  }, [recentUsersAll, sortBy, order]);

  const pagedUsers = useMemo(
    () => sortedUsers.slice(offset, offset + limit),
    [sortedUsers, offset, limit]
  );

  // Reset pagination if timeframe changes or dataset shrinks before current offset
  useEffect(() => {
    if (offset >= sortedUsers.length) {
      setOffset(0);
    }
  }, [timeframe, sortedUsers.length, offset]);

  const total = sortedUsers.length;
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;
  const recentUsers = pagedUsers;
  const isRefetching = (isFetching || isHealthFetching) && !isLoading;

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "-";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const stats = useMemo(
    () => [
      {
        name: "Recent Users",
        value: (dashboardData?.recentUsers?.length || 0).toString(),
        icon: <Users className="h-6 w-6 text-white" />,
        colorClass: StatGradients.BLUE,
        description: `In last ${timeframe} ${
          timeframe === DashboardRecentTimeframe.ONE_DAY ? "day" : "days"
        }`,
      },
      {
        name: "Server Uptime",
        value: formatUptime(
          dashboardData?.systemHealth?.serverUptimeSeconds ??
            systemHealthData?.server?.uptime
        ),
        icon: <Clock className="h-6 w-6 text-white" />,
        colorClass: StatGradients.GREEN,
        description: "",
      },
      {
        name: "Redis Keys",
        value: dashboardData?.systemHealth?.redisKeys?.toLocaleString() || "0",
        icon: <Database className="h-6 w-6 text-white" />,
        colorClass: StatGradients.PURPLE,
        description: "",
      },
    ],
    [dashboardData, timeframe]
  );

  const { hasPermission } = useAuth();
  const { push: pushToast } = useToast();
  const queryClient = useQueryClient();

  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.DASHBOARD] });
  }, [queryClient]);

  const handleSort = (field: string) => {
    setOffset(0);
    baseHandleSort(field);
  };

  const handleBan = async (userId: number) => {
    if (!hasPermission(Permissions.BAN_USERS)) return;
    try {
      await adminApi.banUser(userId);
      pushToast({ variant: "success", title: "User banned" });
      invalidateDashboard();
    } catch (e) {
      pushToast({
        variant: "error",
        title: "Ban failed",
        description: toastMessageFromError(e),
      });
    }
  };

  const handleUnban = async (userId: number) => {
    if (!hasPermission(Permissions.BAN_USERS)) return;
    try {
      await adminApi.unbanUser(userId);
      pushToast({ variant: "success", title: "User unbanned" });
      invalidateDashboard();
    } catch (e) {
      pushToast({
        variant: "error",
        title: "Unban failed",
        description: toastMessageFromError(e),
      });
    }
  };

  const handleDelete = async (userId: number) => {
    if (!hasPermission(Permissions.DELETE_ANOTHER_USER)) return;
    try {
      await adminApi.deleteUser(userId);
      pushToast({ variant: "success", title: "User deleted" });
      invalidateDashboard();
    } catch (e) {
      pushToast({
        variant: "error",
        title: "Delete failed",
        description: toastMessageFromError(e),
      });
    }
  };

  const handleRestore = async (userId: number) => {
    if (!hasPermission(Permissions.DELETE_ANOTHER_USER)) return;
    try {
      await adminApi.restoreUser(userId);
      pushToast({ variant: "success", title: "User restored" });
      invalidateDashboard();
    } catch (e) {
      pushToast({
        variant: "error",
        title: "Restore failed",
        description: toastMessageFromError(e),
      });
    }
  };

  if (isLoading) return <DashboardLoading />;

  if (error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">Dashboard</h1>
          <p className="mt-2 text-secondaryText">
            Welcome to the OpenQuester admin panel
          </p>
        </div>
        <ErrorNotice
          title="Failed to load dashboard data"
          message="Please check your connection and try again."
          icon={<Database className="h-5 w-5 text-error-600" />}
        />
      </div>
    );

  // Main content
  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primaryText tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-secondaryText">
            Welcome to the OpenQuester admin panel
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-mutedText">
          <Clock className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 w-full">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="transform-gpu transition hover:scale-[1.015] focus-within:scale-[1.015]"
          >
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-8">
        {/* Recent Users */}
        <div className="col-span-1">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-header-gradient">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-primaryText flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary-500" />
                  Recent Users
                </h3>
                <div className="flex items-center gap-2">
                  {isRefetching && <InlineSpinner />}
                </div>
              </div>
              <p className="mt-1 text-sm text-secondaryText">
                Latest registered users
              </p>
            </div>

            <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-card/60 backdrop-blur-sm">
              <TimeframeSelector
                value={timeframe}
                onChange={setTimeframe}
                options={TIMEFRAME_OPTIONS}
                disabled={isRefetching}
              />
            </div>

            <div
              className={`relative transition-opacity duration-300 mt-6 ${
                isRefetching ? "opacity-60" : "opacity-100"
              }`}
            >
              <UsersTableView
                users={recentUsers}
                sortBy={sortBy}
                order={order}
                onSort={handleSort}
                hasPermission={hasPermission}
                onView={(u) => setSelectedUser(u)}
                onBan={handleBan}
                onUnban={handleUnban}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
              {total > limit && (
                <div className="p-4 border-t border-border">
                  <UsersPagination
                    total={total}
                    offset={offset}
                    limit={limit}
                    count={recentUsers.length}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    onPrev={() => setOffset(Math.max(0, offset - limit))}
                    onNext={() => setOffset(offset + limit)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={(updatedUser) => {
            setSelectedUser(updatedUser);
            invalidateDashboard();
          }}
        />
      )}
    </div>
  );
};
