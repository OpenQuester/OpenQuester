import { singleton } from "tsyringe";

import { ADMIN_PING_REDIS_SCAN_KEY } from "domain/constants/admin";
import { type AdminPingData } from "domain/types/admin/AdminTypes";
import { LogReaderService } from "application/services/log/LogReaderService";
import { RedisService } from "application/services/redis/RedisService";
import { type LogFilter, type LogScanResult } from "shared/logging/LogReaderTypes";

/**
 * Application service for admin diagnostics backed by infrastructure adapters.
 */
@singleton()
export class AdminDiagnosticsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logReaderService: LogReaderService
  ) {
    //
  }

  public async ping(): Promise<AdminPingData> {
    const start = process.hrtime.bigint();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const end = process.hrtime.bigint();

    const eventLoopLagMs = Number(end - start) / 1_000_000;

    let redisOk = false;
    let redisResponseMs: number | null;

    const redisStart = process.hrtime.bigint();
    try {
      await this.redisService.scan(ADMIN_PING_REDIS_SCAN_KEY);
      redisOk = true;
    } catch {
      redisOk = false;
    } finally {
      const redisEnd = process.hrtime.bigint();
      redisResponseMs = Number(redisEnd - redisStart) / 1_000_000;
    }

    return {
      ok: true,
      eventLoopLagMs: +eventLoopLagMs.toFixed(3),
      redis: {
        connected: redisOk,
        responseMs: redisResponseMs != null ? +redisResponseMs.toFixed(3) : null
      },
      timestamp: new Date().toISOString()
    };
  }

  public async readLogs(filter: LogFilter): Promise<LogScanResult> {
    return this.logReaderService.readLogs(filter);
  }
}
