import { InfluxDBClient, type Point } from "@influxdata/influxdb3-client";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

export interface InfluxDBClientConfig {
  url: string;
}

/**
 * DI-managed InfluxDB client proxy.
 *
 * Encapsulates client lifecycle so higher-level services do not instantiate
 * external clients directly.
 */
@singleton()
export class InfluxDBClientProxy {
  private _client: InfluxDBClient | null = null;
  private _database: string | null = null;

  constructor(@inject(DI_TOKENS.Logger) private readonly logger: ILogger) {
    //
  }

  /**
   * Returns true when a client is configured and ready for writes.
   */
  public get isReady(): boolean {
    return this._client !== null && this._database !== null;
  }

  /**
   * Configures and initializes the InfluxDB client.
   *
   * If an existing client is present, it is closed first.
   */
  public async configure(config: InfluxDBClientConfig): Promise<void> {
    await this.close();

    try {
      const parsedUrl = new URL(config.url);
      this._database =
        parsedUrl.searchParams.get("database") ??
        parsedUrl.searchParams.get("bucket") ??
        null;

      if (!parsedUrl.searchParams.has("token")) {
        parsedUrl.searchParams.set("token", "unused");
      }

      this._client = new InfluxDBClient(parsedUrl.toString());
    } catch (error) {
      this._client = null;
      this._database = null;
      this.logger.error("Failed to configure InfluxDB client", {
        prefix: LogPrefix.INFLUXDB,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Writes points to the configured InfluxDB database.
   */
  public async write(points: Point[]): Promise<void> {
    if (!this.isReady || points.length === 0) {
      return;
    }

    await this._client!.write(points, this._database!);
  }

  /**
   * Returns InfluxDB server version when connected.
   */
  public async getServerVersion(): Promise<string | null> {
    if (!this._client) {
      return null;
    }

    return (await this._client.getServerVersion()) ?? null;
  }

  /**
   * Closes the active client if present.
   */
  public async close(): Promise<void> {
    if (!this._client) {
      return;
    }

    try {
      await this._client.close();
    } catch (error) {
      this.logger.warn("Failed to close InfluxDB client", {
        prefix: LogPrefix.INFLUXDB,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this._client = null;
      this._database = null;
    }
  }
}
