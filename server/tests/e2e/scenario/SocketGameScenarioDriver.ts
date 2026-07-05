import { type GameActionType } from "domain/enums/GameActionType";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import {
  type ScenarioGameDriver,
  type WaitForActionsCompleteOptions,
  type WaitForSubmittedActionsOptions
} from "tests/e2e/scenario/ScenarioGameDriver";
import { type SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/** Scenario driver backed by the existing Socket.IO game test utilities. */
export class SocketGameScenarioDriver implements ScenarioGameDriver {
  public constructor(private readonly utils: SocketGameTestUtils) {}

  public getGameState(gameId: string): Promise<GameStateDTO | null> {
    return this.utils.getGameState(gameId);
  }

  public getFirstAvailableQuestionId(gameId: string): Promise<number> {
    return this.utils.getFirstAvailableQuestionId(gameId);
  }

  public waitForSubmittedActions(options: WaitForSubmittedActionsOptions): Promise<void> {
    return this.utils.waitForSubmittedActions(
      options.gameId,
      options.expectedCount,
      options.actionType as GameActionType | undefined,
      options.timeoutMs
    );
  }

  public waitForActionsComplete(options: WaitForActionsCompleteOptions): Promise<void> {
    return this.utils.waitForActionsComplete(options.gameId, options.timeoutMs);
  }
}
