import { type MetricPoint } from "shared/metrics/MetricPoint";

export interface MetricsWriterConfig {
  url: string;
}

export interface MetricsWriter {
  readonly isReady: boolean;
  configure(config: MetricsWriterConfig): Promise<void>;
  write(points: MetricPoint[]): Promise<void>;
  getServerVersion(): Promise<string | null>;
  close(): Promise<void>;
}
