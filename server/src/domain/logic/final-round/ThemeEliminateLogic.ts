import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { TransitionResult } from "domain/state-machine/types";
import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ThemeEliminateOutputData } from "domain/types/socket/events/FinalRoundEventData";
import {
  ThemeEliminateResult,
  ThemeEliminationTimeoutResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Validation input for theme elimination
 */
export interface ThemeEliminateValidationInput {
  game: Game;
  player: Player | null;
  themeId: number;
  finalRoundHandler: FinalRoundHandler;
}

/**
 * Result of theme elimination mutation
 */
export interface ThemeEliminateMutationResult {
  theme: GameStateThemeDTO;
  turnOrder: number[];
  nextPlayerId: number | null;
}

interface ThemeEliminateTimeoutInput {
  game: Game;
  themeId: number;
  mutationResult: ThemeEliminateMutationResult;
  transitionResult: TransitionResult | null;
}

interface ThemeEliminateResultInput {
  game: Game;
  eliminatedBy: number;
  themeId: number;
  mutationResult: ThemeEliminateMutationResult;
  transitionResult: TransitionResult | null;
}

/**
 * Pure business logic for final round theme elimination.
 *
 * This class encapsulates all validation and state mutation logic,
 * keeping the service layer thin and focused on orchestration.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class ThemeEliminateLogic {
  /**
   * Validates all preconditions for theme elimination.
   *
   * @throws ClientError if validation fails
   */
  public static validate(input: ThemeEliminateValidationInput): void {
    const { game, player, themeId, finalRoundHandler } = input;

    // Game must be in progress
    GameStateValidator.validateGameInProgress(game);

    // Player must exist
    if (!player) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Must be player or showman with elimination rights
    FinalRoundValidator.validateThemeEliminationPlayer(player);
    FinalRoundValidator.validateThemeEliminationPhase(game);

    if (player.role !== PlayerRole.SHOWMAN) {
      FinalRoundValidator.validateEligiblePlayer(game, player);
    }

    // Initialize turn order if needed
    const turnOrder = ThemeEliminateLogic._ensureTurnOrder(
      game,
      finalRoundHandler
    );

    // Non-showman must be current turn player
    if (
      player.role !== PlayerRole.SHOWMAN &&
      !finalRoundHandler.isPlayerTurn(game, player.meta.id, turnOrder)
    ) {
      throw new ClientError(ClientResponse.NOT_YOUR_TURN);
    }

    // Validate theme exists
    const theme = game.gameState.currentRound!.themes.find(
      (t) => t.id === themeId
    );
    if (!theme) {
      throw new ClientError(ClientResponse.THEME_NOT_FOUND);
    }

    // Validate theme is not already eliminated
    if (theme.questions?.some((q) => q.isPlayed)) {
      throw new ClientError(ClientResponse.THEME_ALREADY_ELIMINATED);
    }

    // Cannot eliminate the last theme
    const activeThemes = finalRoundHandler.getActiveThemes(game);
    if (activeThemes.length <= 1) {
      throw new ClientError(ClientResponse.CANNOT_ELIMINATE_LAST_THEME);
    }
  }

  /**
   * Eliminates the theme and updates game state.
   *
   * @returns Mutation result with theme, turn order, and next player
   */
  public static eliminateTheme(
    game: Game,
    themeId: number,
    finalRoundHandler: FinalRoundHandler
  ): ThemeEliminateMutationResult {
    // Find the theme (already validated to exist)
    const theme = game.gameState.currentRound!.themes.find(
      (t) => t.id === themeId
    )!;

    // Mark theme as eliminated by setting first question as played
    if (theme.questions && theme.questions.length > 0) {
      theme.questions[0].isPlayed = true;
    }

    // Update final round data
    ThemeEliminateLogic._initializeFinalRoundDataIfNeeded(game);
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game)!;
    finalRoundData.eliminatedThemes.push(themeId);

    // Get turn order
    const turnOrder = ThemeEliminateLogic._ensureTurnOrder(
      game,
      finalRoundHandler
    );

    // Determine next player (only if not phase complete)
    let nextPlayerId: number | null = null;
    if (!finalRoundHandler.isThemeEliminationComplete(game)) {
      const currentTurnPlayer = finalRoundHandler.getCurrentTurnPlayer(
        game,
        turnOrder
      );
      if (currentTurnPlayer !== null) {
        game.gameState.currentTurnPlayerId = currentTurnPlayer;
        nextPlayerId = currentTurnPlayer;
      }
    }

    // Persist final round data
    FinalRoundStateManager.updateFinalRoundData(game, finalRoundData);

    return {
      theme,
      turnOrder,
      nextPlayerId,
    };
  }

  /**
   * Selects a random theme for elimination (used by timeout).
   *
   * @returns The randomly selected theme ID
   */
  public static selectRandomTheme(
    game: Game,
    finalRoundHandler: FinalRoundHandler
  ): number {
    const activeThemes = finalRoundHandler.getActiveThemes(game);

    if (activeThemes.length <= 1) {
      throw new ClientError(ClientResponse.CANNOT_ELIMINATE_LAST_THEME);
    }

    const randomIndex = Math.floor(Math.random() * activeThemes.length);
    return activeThemes[randomIndex].id!;
  }

  /**
   * Builds the result object from elimination data and transition outcome.
   * Includes THEME_ELIMINATE broadcast and any transition broadcasts.
   */
  public static buildResult(
    input: ThemeEliminateResultInput
  ): ThemeEliminateResult {
    const { game, eliminatedBy, themeId, mutationResult, transitionResult } =
      input;

    let timer: GameStateTimerDTO | undefined;
    if (transitionResult?.success && transitionResult.timer) {
      timer = transitionResult.timer;
    }

    const outputData: ThemeEliminateOutputData = {
      themeId,
      eliminatedBy,
      nextPlayerId: transitionResult?.success
        ? null
        : mutationResult.nextPlayerId,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.THEME_ELIMINATE,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<ThemeEliminateOutputData>,
    ];

    // Add transition broadcasts if transition occurred (service uses satisfies)
    if (transitionResult?.success && transitionResult.broadcasts) {
      broadcasts.push(
        ...convertBroadcasts(transitionResult.broadcasts, game.id)
      );
    }

    return {
      data: outputData,
      broadcasts,
      game,
      eliminatedBy,
      themeId,
      nextPlayerId: transitionResult?.success
        ? null
        : mutationResult.nextPlayerId,
      isPhaseComplete: transitionResult?.success ?? false,
      timer,
      transitionResult,
    };
  }

  /**
   * Builds the result object for timeout-driven theme elimination.
   *
   * Note: timeout flow relies on whether a transition occurred (non-null),
   * matching existing service semantics.
   */
  public static buildTimeoutResult(
    input: ThemeEliminateTimeoutInput
  ): ThemeEliminationTimeoutResult {
    const { game, themeId, mutationResult, transitionResult } = input;

    return {
      game,
      themeId,
      nextPlayerId: mutationResult.nextPlayerId,
      isPhaseComplete: transitionResult !== null,
      transitionResult,
    } satisfies ThemeEliminationTimeoutResult;
  }

  /**
   * Ensures turn order is initialized.
   */
  private static _ensureTurnOrder(
    game: Game,
    finalRoundHandler: FinalRoundHandler
  ): number[] {
    let turnOrder = game.gameState.finalRoundData?.turnOrder;

    if (!turnOrder || turnOrder.length === 0) {
      turnOrder = finalRoundHandler.initializeTurnOrder(game);
      if (game.gameState.finalRoundData) {
        game.gameState.finalRoundData.turnOrder = turnOrder;
      }
    }

    return turnOrder;
  }

  /**
   * Initializes final round data if not present.
   */
  private static _initializeFinalRoundDataIfNeeded(game: Game): void {
    if (!game.gameState.finalRoundData) {
      game.gameState.finalRoundData = {
        phase: FinalRoundPhase.THEME_ELIMINATION,
        eliminatedThemes: [],
        turnOrder: [],
        bids: {},
        answers: [],
      };
    }
  }
}
