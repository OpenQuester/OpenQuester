// Named refresh interval constants (ms) - enum form for stronger typing
export enum RefreshInterval {
  DASHBOARD = 30_000,
  SYSTEM_HEALTH = 10_000,
  PING = 5_000,
}

export const getRefreshInterval = (key: RefreshInterval) => key as number;
