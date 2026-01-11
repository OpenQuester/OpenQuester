import { container } from "tsyringe";
import { GameActionLockService } from "infrastructure/services/lock/GameActionLockService";
import { GameActionQueueService } from "infrastructure/services/queue/GameActionQueueService";
import { GameClientSocket } from "./SocketIOGameTestUtils";

export class SocketGameTestEventUtils {
  private lockService = container.resolve(GameActionLockService);
  private queueService = container.resolve(GameActionQueueService);

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: T) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler); // Ensure listener is removed
        resolve(data);
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      };

      timeoutId = setTimeout(onTimeout, timeout);
      socket.once(event, handler);
    });
  }

  /**
   * Waits for a specified time to ensure that a specific event is NOT received.
   * If the event is received, the promise rejects immediately.
   * If the timeout completes without the event, the promise resolves successfully.
   */
  public async waitForNoEvent(
    socket: GameClientSocket,
    event: string,
    timeout: number = 150
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const handler = (data: any) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeListener(event, handler);
        reject(
          new Error(
            `Unexpected event received: ${event}. Data: ${JSON.stringify(data)}`
          )
        );
      };

      const onTimeout = () => {
        timeoutId = null;
        socket.removeListener(event, handler);
        resolve(); // Success - no event was received
      };

      timeoutId = setTimeout(onTimeout, timeout);
      socket.once(event, handler);
    });
  }

  /**
   * Wait for all queued actions and locks to complete for a game
   * This ensures clean test teardown without race conditions
   */
  public async waitForActionsComplete(
    gameId: string,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isLocked = await this.lockService.isLocked(gameId);
      const queueLength = await this.queueService.getQueueLength(gameId);

      if (!isLocked && queueLength === 0) {
        // All actions complete
        return;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
