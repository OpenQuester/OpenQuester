import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { ThemeEliminateLogic } from "domain/logic/final-round/ThemeEliminateLogic";
import {
  TurnPlayerLeaveLogic,
  TurnPlayerScenarioType,
} from "domain/logic/player-leave/TurnPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

@singleton()
export class TurnPlayerLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {}

  public canHandle(game: Game, userId: number): boolean {
    return TurnPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const validation = TurnPlayerLeaveLogic.validate(game, userId);

    if (
      validation.scenarioType ===
      TurnPlayerScenarioType.FINAL_ROUND_THEME_ELIMINATION
    ) {
      return this._handleFinalRoundTurnPlayerLeave(game, userId);
    }

    TurnPlayerLeaveLogic.processRegularRoundLeave(game);
    return { mutations: [], broadcasts: [] };
  }

  private async _handleFinalRoundTurnPlayerLeave(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const finalRoundHandler = this._getFinalRoundHandler(game);

    const themeId = ThemeEliminateLogic.selectRandomTheme(
      game,
      finalRoundHandler
    );

    const mutationResult = ThemeEliminateLogic.eliminateTheme(
      game,
      themeId,
      finalRoundHandler
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    const themeEliminateResult = ThemeEliminateLogic.buildResult({
      game,
      eliminatedBy: userId,
      themeId,
      mutationResult,
      transitionResult,
    });

    const leaveResult = TurnPlayerLeaveLogic.buildFinalRoundResult(
      game,
      themeEliminateResult
    );

    result.broadcasts.push(...leaveResult.broadcasts);

    if (transitionResult) {
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        )
      );
    }

    return result;
  }

  private _getFinalRoundHandler(game: Game): FinalRoundHandler {
    const handler = this.roundHandlerFactory.createFromGame(game);
    if (handler.getRoundType() !== PackageRoundType.FINAL) {
      throw new Error("Expected final round handler");
    }
    return handler as FinalRoundHandler;
  }
}
