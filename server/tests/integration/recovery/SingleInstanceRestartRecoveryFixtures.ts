import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { asUserId } from "domain/types/ids";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ILogger } from "shared/logging/ILogger";
import type { LogLevel, PerformanceLog } from "shared/logging/LoggerTypes";
import type { LogMeta } from "shared/logging/LogMeta";
import type { LogType } from "shared/logging/LogType";

export class TestLogger extends ILogger {
  info(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  debug(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  trace(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  warn(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  error(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  audit(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  performance(_msg: string, _meta: LogMeta): PerformanceLog {
    return { finish: () => undefined };
  }

  migration(_msg: string, _meta: LogMeta): void {
    // no-op
  }

  log(_type: LogType, _msg: string, _meta: LogMeta): void {
    // no-op
  }

  checkAccess(_logLevel: LogLevel, _requiredLogLevel: LogLevel): boolean {
    return true;
  }
}

export const recoveryTimerDurationMs = 30_000;
export const activeTimerTtlMs = 25_000;
export const oldStartedAt = new Date("2026-01-01T10:00:00.000Z");

export function buildTimer(): GameStateTimerDTO {
  return {
    durationMs: recoveryTimerDurationMs,
    elapsedMs: 12_500,
    startedAt: oldStartedAt,
    resumedAt: null
  };
}

export function buildGame(id: string, timer: GameStateTimerDTO | null): Game {
  return new Game({
    id,
    title: `Recovery ${id}`,
    createdBy: asUserId(1),
    createdAt: new Date("2026-01-01T09:00:00.000Z"),
    isPrivate: true,
    ageRestriction: AgeRestriction.NONE,
    maxPlayers: 8,
    startedAt: new Date("2026-01-01T09:30:00.000Z"),
    finishedAt: null,
    roundIndex: [{ order: 0, type: PackageRoundType.SIMPLE }],
    roundsCount: 1,
    questionsCount: 1,
    players: [buildPlayer(1, PlayerRole.SHOWMAN), buildPlayer(2), buildPlayer(3)],
    gameState: {
      questionState: QuestionState.SHOWING,
      isPaused: false,
      currentRound: {
        id: 10,
        order: 0,
        name: "Round 1",
        description: "preserved round",
        themes: [],
        type: PackageRoundType.SIMPLE
      },
      currentQuestion: {
        id: 20,
        type: PackageQuestionType.SIMPLE,
        order: 1,
        price: 100,
        isHidden: false,
        text: "preserved question",
        answerDelay: 0,
        questionComment: "preserved comment",
        questionFiles: null,
        subType: PackageQuestionSubType.SIMPLE,
        showAnswerDuration: 5000
      },
      answeringPlayer: null,
      answeredPlayers: null,
      readyPlayers: [2],
      timer,
      skippedPlayers: [3],
      password: "SAFE",
      answerShowData: null,
      secretQuestionData: null,
      stakeQuestionData: null,
      questionEligiblePlayers: [2, 3]
    }
  });
}

function buildPlayer(id: number, role: PlayerRole = PlayerRole.PLAYER): Player {
  return new Player({
    meta: {
      id,
      username: `user-${id}`,
      avatar: null
    },
    role,
    status: PlayerGameStatus.IN_GAME,
    score: id * 100,
    slot: role === PlayerRole.PLAYER ? id - 1 : null,
    restrictionData: {
      muted: false,
      restricted: false,
      banned: false
    },
    mediaDownloaded: true
  });
}
