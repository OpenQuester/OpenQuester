export interface SingleInstanceGameRecoveryResult {
  status: "completed";
  recoveredGames: number;
  recoveredTimers: number;
}

export interface SingleInstanceSocketSessionCleanupResult {
  status: "completed";
  removedSocketSessions: number;
  removedUserSocketLookups: number;
}

export type SingleInstanceRestartRecoveryResult =
  | {
      status: "disabled";
    }
  | {
      status: "completed";
      gameRecovery: SingleInstanceGameRecoveryResult;
      socketSessionCleanup: SingleInstanceSocketSessionCleanupResult;
    };
