import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";

export interface GameProgressionResult {
  success: boolean;
  /** Array of socket events to broadcast */
  broadcasts: SocketEventBroadcast[];
  /** Optional response data */
  data?: unknown;
}
