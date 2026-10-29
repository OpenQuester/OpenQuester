import { type Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction, type GameActionResult } from "domain/types/action/GameAction";
import { type ChatSystemEntry } from "domain/types/dto/game/chat/ChatSystemEntry";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { type AnswerResultUndoEventPayload } from "domain/types/socket/events/game/ShowmanToolsEventPayloads";

export interface ShowmanLogLine {
  /** English text, for clients that don't know `system.action` */
  message: string;
  system: ChatSystemEntry;
}

type Params = ChatSystemEntry["params"];

/**
 * Turns what the showman just did into a chat line everyone can see, so a
 * ruling, a score fix or a kick never happens silently.
 *
 * Names, prices and themes are resolved now: the line still makes sense after
 * the player leaves or the board changes.
 */
export class ShowmanActionLogLogic {
  public static build(
    action: GameAction,
    result: GameActionResult,
    game: Game
  ): ShowmanLogLine | null {
    if (!result.success) {
      return null;
    }

    const actor = game.getPlayer(action.playerId, { fetchDisconnected: true });
    if (actor?.role !== PlayerRole.SHOWMAN) {
      return null;
    }

    const entry = this._entry(action, result, game);
    if (!entry) {
      return null;
    }

    return {
      message: this._english(entry.action, entry.params),
      system: entry
    };
  }

  private static _entry(
    action: GameAction,
    result: GameActionResult,
    game: Game
  ): ChatSystemEntry | null {
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const name = (id: unknown) =>
      typeof id === "number"
        ? (game.getPlayer(id, { fetchDisconnected: true })?.meta.username ?? null)
        : null;
    const entry = (params: Params = {}): ChatSystemEntry => ({ action: action.type, params });

    switch (action.type) {
      case GameActionType.START:
      case GameActionType.PAUSE:
      case GameActionType.UNPAUSE:
      case GameActionType.SKIP_QUESTION_FORCE:
      case GameActionType.BUZZER_OPEN:
        return entry();

      case GameActionType.NEXT_ROUND:
        return entry({ round: game.gameState.currentRound?.name ?? null });

      case GameActionType.QUESTION_PICK:
      case GameActionType.QUESTION_REMOVE_RESTORE: {
        const cell = this._cell(game, payload.questionId);
        if (!cell) {
          return null;
        }

        const played = this._isPlayed(game, payload.questionId);

        return entry({
          ...cell,
          ...(action.type === GameActionType.QUESTION_REMOVE_RESTORE ? { removed: played } : {})
        });
      }

      case GameActionType.ANSWER_RESULT: {
        const data = result.data as QuestionAnswerResultEventPayload | undefined;
        const answer = data?.answerResult;
        if (!answer) {
          return null;
        }

        return entry({
          player: name(answer.player),
          points: answer.result,
          answerType: answer.answerType
        });
      }

      case GameActionType.LAST_ANSWER_RULING_REVERT: {
        const data = result.data as AnswerResultUndoEventPayload | undefined;
        if (!data) {
          return null;
        }

        return entry({ player: name(data.playerId), points: -data.revertedResult });
      }

      case GameActionType.GAME_JOIN_MODE_CHANGE:
        return entry({ joinMode: String(payload.joinMode ?? "open") });

      case GameActionType.GAME_SETTINGS_CHANGE:
        return entry(this._settingsChange(payload));

      case GameActionType.PLAYER_KICK:
        return entry({ player: name(payload.playerId) });

      case GameActionType.PLAYER_RESTRICTION:
        return entry({
          player: name(payload.playerId),
          muted: Boolean(payload.muted),
          restricted: Boolean(payload.restricted),
          banned: Boolean(payload.banned)
        });

      case GameActionType.PLAYER_ROLE_CHANGE: {
        const target = typeof payload.playerId === "number" ? payload.playerId : action.playerId;

        return entry({ player: name(target), role: String(payload.newRole ?? "") });
      }

      case GameActionType.PLAYER_SCORE_CHANGE:
        return entry({
          player: name(payload.playerId),
          score: typeof payload.newScore === "number" ? payload.newScore : null
        });

      case GameActionType.PLAYER_SLOT_CHANGE:
        // Moving yourself is a lobby seat change, not a ruling
        if (typeof payload.playerId !== "number" || payload.playerId === action.playerId) {
          return null;
        }

        return entry({
          player: name(payload.playerId),
          slot: typeof payload.targetSlot === "number" ? payload.targetSlot + 1 : null
        });

      case GameActionType.TURN_PLAYER_CHANGE:
        return entry({ player: name(payload.newTurnPlayerId) });

      case GameActionType.SECRET_QUESTION_TRANSFER:
        return entry({ player: name(payload.targetPlayerId) });

      case GameActionType.EVERYONE_ANSWER_REVIEW:
        return entry({ player: name(payload.playerId), correct: Boolean(payload.isCorrect) });

      case GameActionType.FINAL_ANSWER_REVIEW: {
        const answer = game.gameState.finalRoundData?.answers.find(
          (a) => a.id === payload.answerId
        );

        return entry({ player: name(answer?.playerId), correct: Boolean(payload.isCorrect) });
      }

      case GameActionType.THEME_ELIMINATE: {
        const theme = game.gameState.currentRound?.themes.find((t) => t.id === payload.themeId);

        return entry({ theme: theme?.name ?? null });
      }

      default:
        return null;
    }
  }

  private static _cell(game: Game, questionId: unknown): Params | null {
    for (const theme of game.gameState.currentRound?.themes ?? []) {
      const question = theme.questions.find((q) => q.id === questionId);
      if (question) {
        return { theme: theme.name, price: question.price };
      }
    }

    return null;
  }

  /** The changed rules and timers (in ms) as flat params */
  private static _settingsChange(payload: Record<string, unknown>): Params {
    const params: Params = {};
    const { timers, ...rules } = payload;
    const values = { ...rules, ...(timers as Record<string, unknown> | undefined) };

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params[key] = value;
      }
    }

    return params;
  }

  private static _isPlayed(game: Game, questionId: unknown): boolean {
    for (const theme of game.gameState.currentRound?.themes ?? []) {
      const question = theme.questions.find((q) => q.id === questionId);
      if (question) {
        return question.isPlayed;
      }
    }

    return false;
  }

  private static _english(action: string, p: Params): string {
    const who = p.player ?? "a player";
    const signed = (n: unknown) => (typeof n === "number" && n > 0 ? `+${n}` : String(n ?? 0));

    switch (action) {
      case GameActionType.START:
        return "Showman started the game";
      case GameActionType.PAUSE:
        return "Showman paused the game";
      case GameActionType.UNPAUSE:
        return "Showman resumed the game";
      case GameActionType.SKIP_QUESTION_FORCE:
        return "Showman revealed the answer";
      case GameActionType.BUZZER_OPEN:
        return "Showman opened the buzzer early";
      case GameActionType.NEXT_ROUND:
        return `Showman moved on to the next round${p.round ? `: ${p.round}` : ""}`;
      case GameActionType.QUESTION_PICK:
        return `Showman picked ${p.theme} for ${p.price ?? 0}`;
      case GameActionType.QUESTION_REMOVE_RESTORE:
        return `Showman ${p.removed ? "removed" : "restored"} ${p.theme} for ${p.price ?? 0}`;
      case GameActionType.ANSWER_RESULT:
        return `Showman judged ${who}'s answer ${p.answerType === "correct" ? "right" : "wrong"} (${signed(p.points)})`;
      case GameActionType.LAST_ANSWER_RULING_REVERT:
        return `Showman took back the ruling on ${who} (${signed(p.points)})`;
      case GameActionType.GAME_JOIN_MODE_CHANGE:
        return `Showman set who can join: ${p.joinMode}`;
      case GameActionType.GAME_SETTINGS_CHANGE:
        return `Showman changed the game rules: ${Object.keys(p).join(", ")}`;
      case GameActionType.PLAYER_KICK:
        return `Showman removed ${who} from the game`;
      case GameActionType.PLAYER_RESTRICTION:
        return `Showman changed ${who}'s restrictions`;
      case GameActionType.PLAYER_ROLE_CHANGE:
        return `Showman made ${who} a ${p.role}`;
      case GameActionType.PLAYER_SCORE_CHANGE:
        return `Showman set ${who}'s score to ${p.score ?? 0}`;
      case GameActionType.PLAYER_SLOT_CHANGE:
        return `Showman moved ${who} to seat ${p.slot ?? "?"}`;
      case GameActionType.TURN_PLAYER_CHANGE:
        return p.player ? `Showman gave the pick to ${p.player}` : "Showman took the pick";
      case GameActionType.SECRET_QUESTION_TRANSFER:
        return `Showman gave the question to ${who}`;
      case GameActionType.EVERYONE_ANSWER_REVIEW:
      case GameActionType.FINAL_ANSWER_REVIEW:
        return `Showman judged ${who}'s answer ${p.correct ? "right" : "wrong"}`;
      case GameActionType.THEME_ELIMINATE:
        return `Showman removed the theme ${p.theme ?? ""}`.trim();
      default:
        return "Showman did something";
    }
  }
}
