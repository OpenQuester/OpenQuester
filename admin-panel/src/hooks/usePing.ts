import { adminApi } from "@/api/admin";
import { QueryKeys } from "@/constants/queryKeys";
import { RefreshInterval } from "@/constants/refreshIntervals";
import { useQuery } from "@tanstack/react-query";

interface PingData {
  ok: boolean;
  eventLoopLagMs: number;
  redis: { connected: boolean; responseMs: number | null };
  timestamp: string;
}

export const usePing = () => {
  return useQuery<PingData>({
    queryKey: [QueryKeys.PING],
    queryFn: adminApi.getPing,
    refetchInterval: RefreshInterval.PING,
  });
};
