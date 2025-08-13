import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";

export interface GameProgressionResult {
  success: boolean;
  /** Array of socket events to broadcast */
  broadcasts: SocketEventBroadcast[];
  /** Optional response data */
  data?: unknown;
}
