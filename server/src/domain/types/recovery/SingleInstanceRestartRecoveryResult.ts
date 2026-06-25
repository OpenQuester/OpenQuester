export type SingleInstanceGameRecoveryResult =
  | {
      status: "completed";
      recoveredGames: number;
      recoveredTimers: number;
    }
  | {
      status: "lock-not-acquired";
    };

export type SingleInstanceSocketSessionCleanupResult =
  | {
      status: "completed";
      removedSocketSessions: number;
      removedUserSocketLookups: number;
    }
  | {
      status: "lock-not-acquired";
    };

export type SingleInstanceRestartRecoveryResult =
  | {
      status: "disabled";
    }
  | {
      status: "completed";
      gameRecovery: Extract<SingleInstanceGameRecoveryResult, { status: "completed" }>;
      socketSessionCleanup: Extract<
        SingleInstanceSocketSessionCleanupResult,
        { status: "completed" }
      >;
    };
