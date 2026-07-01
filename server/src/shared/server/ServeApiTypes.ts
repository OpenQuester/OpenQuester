export type ServeApiState =
  | "created"
  | "initializing"
  | "listening_not_ready"
  | "running"
  | "failed"
  | "shutting_down"
  | "shutdown"
  | "shutdown_failed";

export interface SocketDiagnostic {
  namespace: string;
  socketId: string;
  userId: number | undefined;
  gameId: string | null | undefined;
}
