import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";

/**
 * Base result type for service methods called by action handlers.
 * Ensures services return broadcasts that handlers can pass through directly.
 *
 * @template TData - The specific data type returned by the service method
 */
export interface ActionServiceResult<TData = unknown> {
  /** Service-specific data */
  data: TData;
  /** Broadcasts to emit after successful execution */
  broadcasts: SocketEventBroadcast[];
}

/**
 * Helper type to extract the data portion from an ActionServiceResult.
 * Useful when handlers need to return a subset of the service result.
 */
export type ActionServiceData<T extends ActionServiceResult> = T["data"];
