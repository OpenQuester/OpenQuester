import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type MetricPoint } from "shared/metrics/MetricPoint";
import { type MetricsWriter, type MetricsWriterConfig } from "shared/metrics/MetricsWriter";

@singleton()
export class InfluxDBMetricsWriter implements MetricsWriter {
  private _client: InfluxDBClient | null = null;
  private _database: string | null = null;

  constructor(@inject(DI_TOKENS.Logger) private readonly logger: ILogger) {
    //
  }

  public get isReady(): boolean {
    return this._client !== null && this._database !== null;
  }

  public async configure(config: MetricsWriterConfig): Promise<void> {
    await this.close();

    try {
      const parsedUrl = new URL(config.url);
      this._database =
        parsedUrl.searchParams.get("database") ?? parsedUrl.searchParams.get("bucket") ?? null;

      if (!parsedUrl.searchParams.has("token")) {
        parsedUrl.searchParams.set("token", "unused");
      }

      this._client = new InfluxDBClient(parsedUrl.toString());
    } catch (error) {
      this._client = null;
      this._database = null;
      this.logger.error("Failed to configure InfluxDB client", {
        prefix: LogPrefix.INFLUXDB,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public async write(points: MetricPoint[]): Promise<void> {
    if (!this.isReady || points.length === 0) {
      return;
    }

    await this._client!.write(
      points.map((point) => this.toInfluxPoint(point)),
      this._database!
    );
  }

  public async getServerVersion(): Promise<string | null> {
    if (!this._client) {
      return null;
    }

    return (await this._client.getServerVersion()) ?? null;
  }

  public async close(): Promise<void> {
    if (!this._client) {
      return;
    }

    try {
      await this._client.close();
    } catch (error) {
      this.logger.warn("Failed to close InfluxDB client", {
        prefix: LogPrefix.INFLUXDB,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this._client = null;
      this._database = null;
    }
  }

  private toInfluxPoint(metricPoint: MetricPoint): Point {
    let point = Point.measurement(metricPoint.measurement);

    for (const [key, value] of Object.entries(metricPoint.tags)) {
      point = point.setTag(key, value);
    }

    for (const [key, field] of Object.entries(metricPoint.fields)) {
      switch (field.kind) {
        case "float":
          point = point.setFloatField(key, Number(field.value));
          break;
        case "integer":
          point = point.setIntegerField(key, Number(field.value));
          break;
        case "string":
          point = point.setStringField(key, String(field.value));
          break;
        case "boolean":
          point = point.setBooleanField(key, Boolean(field.value));
          break;
      }
    }

    return point;
  }
}
