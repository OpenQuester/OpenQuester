export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  performance: 35,
  error: 50,
  audit: 60,
  migration: 70
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

export interface PerformanceLog {
  finish(additionalMeta?: object): void;
}
