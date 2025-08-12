import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/api/admin";
import { QueryKeys } from "@/constants/queryKeys";
import { RefreshInterval } from "@/constants/refreshIntervals";
import {
  type AdminDashboardData,
  type DashboardRecentTimeframe,
} from "@/types/dto";

export const useDashboardData = (timeframe: DashboardRecentTimeframe) => {
  return useQuery<AdminDashboardData>({
    queryKey: [QueryKeys.DASHBOARD, timeframe],
    queryFn: () =>
      adminApi.getDashboard({
        timeframe,
      }),
    // Preserve previous data while refetching to prevent empty->filled flicker under overlay
    placeholderData: (previousData) => previousData,
    refetchInterval: RefreshInterval.DASHBOARD,
  });
};
