import {
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  RefreshCw,
  WifiOff,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { DetailCard } from "@/components/common/DetailCard";
import { ErrorNotice } from "@/components/common/ErrorNotice";
import { HealthMetric, HealthStatus } from "@/components/common/HealthMetric";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { usePing } from "@/hooks/usePing";
import { useSystemHealthData } from "@/hooks/useSystemHealthData";

export const SystemHealthPage = () => {
  const { data, isLoading, error, refetch } = useSystemHealthData();
  const { data: ping } = usePing();
  const [spinning, setSpinning] = useState(false);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getMemoryUsagePercentage = () => {
    if (!data?.server?.memory?.used || !data?.server?.memory?.total) return 0;
    return Math.round(
      (data.server.memory.used / data.server.memory.total) * 100
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-hover rounded w-48 mb-2"></div>
          <div className="h-4 bg-hover rounded w-64"></div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-hover rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-hover rounded w-20 mb-2"></div>
                    <div className="h-6 bg-hover rounded w-16"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">System Health</h1>
          <p className="mt-2 text-secondaryText">
            Monitor system status and performance metrics
          </p>
        </div>
        <ErrorNotice
          title="Failed to load system health data"
          message="Unable to connect to monitoring services"
          icon={<AlertTriangle className="h-5 w-5 text-error-600" />}
        />
        <button
          onClick={() => refetch()}
          className="btn btn-primary inline-flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const memoryUsagePercent = getMemoryUsagePercentage();
  const isRedisHealthy = data?.redis?.connected;
  const isServerHealthy = data?.server?.uptime && data?.server?.uptime > 0;
  const eventLoopLag = ping?.eventLoopLagMs ?? null;
  const redisRespMs = ping?.redis?.responseMs ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primaryText">System Health</h1>
          <p className="mt-2 text-secondaryText">
            Monitor system status and performance metrics
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-mutedText">
            <Clock className="h-4 w-4" />
            <span>Auto-refresh: 10s</span>
          </div>
          <button
            onClick={() => {
              if (!spinning) {
                setSpinning(true);
                setTimeout(() => setSpinning(false), 600); // allow 360deg animation to complete
              }
              void refetch();
            }}
            className="btn btn-secondary"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 transition-transform duration-500 ${
                spinning ? "rotate-180 scale-105" : ""
              } ${spinning ? "animate-spin-slow-once" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Status */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  isRedisHealthy && isServerHealthy
                    ? "bg-gradient-to-br from-success-500 to-success-600"
                    : "bg-gradient-to-br from-error-500 to-error-600"
                }`}
              >
                {isRedisHealthy && isServerHealthy ? (
                  <Zap className="h-8 w-8 text-white" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primaryText">
                  System Status
                </h2>
                <p
                  className={`text-lg font-medium ${
                    isRedisHealthy && isServerHealthy
                      ? "text-success-600"
                      : "text-error-600"
                  }`}
                >
                  {isRedisHealthy && isServerHealthy
                    ? "All Systems Operational"
                    : "Issues Detected"}
                </p>
                <p className="text-sm text-mutedText">
                  Last updated:{" "}
                  {data?.timestamp
                    ? new Date(data.timestamp).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <HealthMetric
          title="Redis"
          value={isRedisHealthy ? "Active" : "Inactive"}
          status={isRedisHealthy ? HealthStatus.HEALTHY : HealthStatus.ERROR}
          icon={<Database className="h-6 w-6 text-white" />}
          description={`${
            data?.redis?.keys?.toLocaleString() || "0"
          } keys stored${
            redisRespMs != null ? ` • ${redisRespMs.toFixed(2)}ms` : ""
          }`}
        />
        <HealthMetric
          title="Memory Usage"
          value={`${memoryUsagePercent}%`}
          status={
            memoryUsagePercent > 90
              ? HealthStatus.ERROR
              : memoryUsagePercent > 75
              ? HealthStatus.WARNING
              : HealthStatus.HEALTHY
          }
          icon={<Cpu className="h-6 w-6 text-white" />}
          description={`${data?.server?.memory?.used || 0}MB / ${
            data?.server?.memory?.total || 0
          }MB`}
        />
        <HealthMetric
          title="Event Loop"
          value={
            eventLoopLag != null ? `${eventLoopLag.toFixed(2)} ms` : "Unknown"
          }
          status={(() => {
            if (eventLoopLag == null) return HealthStatus.ERROR;
            if (eventLoopLag < 10) return HealthStatus.HEALTHY;
            if (eventLoopLag < 50) return HealthStatus.WARNING;
            return HealthStatus.ERROR;
          })()}
          icon={<Cpu className="h-6 w-6 text-white" />}
          description={
            eventLoopLag != null ? "Event loop delay" : "Awaiting ping"
          }
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Redis Details */}
        <DetailCard
          title="Redis Cache Service"
          description="In-memory data structure store details"
        >
          <div className="space-y-1">
            <StatusIndicator
              label="Connection Status"
              status={isRedisHealthy ? "online" : "offline"}
              value={isRedisHealthy ? "Connected" : "Disconnected"}
            />
            <StatusIndicator
              label="Total Keys"
              status="online"
              value={data?.redis?.keys?.toLocaleString() || "0"}
            />
            <StatusIndicator
              label="Estimated Memory"
              status="online"
              value={
                data?.redis ? `~${data.redis.estimatedMemoryMB} MB` : "N/A"
              }
            />
            {redisRespMs != null && (
              <StatusIndicator
                label="Response Time"
                status={
                  redisRespMs > 50
                    ? redisRespMs > 120
                      ? "warning"
                      : "warning"
                    : "online"
                }
                value={`${redisRespMs.toFixed(2)} ms`}
              />
            )}
          </div>
          {!isRedisHealthy && (
            <div className="mt-4 p-3 bg-error-50 rounded-lg border border-error-200">
              <div className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-error-600" />
                <span className="text-sm font-medium text-error-800">
                  Redis connection lost
                </span>
              </div>
              <p className="text-xs text-error-600 mt-1">
                Cache operations may be slower. Check Redis server status.
              </p>
            </div>
          )}
        </DetailCard>

        {/* Server Details */}
        <DetailCard
          title="Application Server"
          description="Node.js runtime and system resources"
        >
          <div className="space-y-1">
            <StatusIndicator
              label="Server Status"
              status={isServerHealthy ? "online" : "offline"}
              value={isServerHealthy ? "Running" : "Stopped"}
            />
            <StatusIndicator
              label="Uptime"
              status="online"
              value={
                data?.server?.uptime ? formatUptime(data.server.uptime) : "N/A"
              }
            />
            <StatusIndicator
              label="Memory Usage"
              status={memoryUsagePercent > 85 ? "warning" : "online"}
              value={`${data?.server?.memory?.used || 0} MB`}
            />
            <StatusIndicator
              label="Available Memory"
              status="online"
              value={`${
                (data?.server?.memory?.total || 0) -
                (data?.server?.memory?.used || 0)
              } MB`}
            />
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-secondaryText">
                Memory Usage
              </span>
              <span className="text-mutedText">{memoryUsagePercent}%</span>
            </div>
            <div className="w-full bg-hover rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  memoryUsagePercent > 90
                    ? "bg-error-500"
                    : memoryUsagePercent > 75
                    ? "bg-warning-500"
                    : "bg-success-500"
                }`}
                style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </DetailCard>
      </div>
    </div>
  );
};
