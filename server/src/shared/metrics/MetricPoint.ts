export type MetricFieldKind = "float" | "integer" | "string" | "boolean";

export interface MetricField {
  kind: MetricFieldKind;
  value: number | string | boolean;
}

export interface MetricPoint {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, MetricField>;
}

export const metricFloat = (value: number): MetricField => ({ kind: "float", value });
export const metricInteger = (value: number): MetricField => ({ kind: "integer", value });
export const metricString = (value: string): MetricField => ({ kind: "string", value });
export const metricBoolean = (value: boolean): MetricField => ({ kind: "boolean", value });
