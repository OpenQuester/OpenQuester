import { adminApi } from "@/api/admin";
import { QueryKeys } from "@/constants/queryKeys";
import { RefreshInterval } from "@/constants/refreshIntervals";
import { type SystemHealthData } from "@/types/dto";
import { useQuery } from "@tanstack/react-query";

export const useSystemHealthData = () => {
  return useQuery<SystemHealthData>({
    queryKey: [QueryKeys.SYSTEM_HEALTH],
    queryFn: adminApi.getSystemHealth,
    refetchInterval: RefreshInterval.SYSTEM_HEALTH,
  });
};
