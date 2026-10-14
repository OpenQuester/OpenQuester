import { isDeepStrictEqual } from "node:util";

import {
  CONTENT_IMAGE_TIME,
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT
} from "domain/constants/game";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { type PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { type MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";

export function assertMediaFixtureFiles(
  files: readonly PackageQuestionFileDTO[],
  includesMedia = true
): void {
  if (!includesMedia) {
    if (files.length !== 0) throw new Error("No-file fixture unexpectedly contains question media");
    return;
  }
  if (
    files.length !== 1 ||
    files[0].file.md5 !== TEST_MEDIA_FILE_MD5 ||
    files[0].file.type !== PackageFileType.IMAGE ||
    files[0].order !== 0 ||
    files[0].displayTime !== null
  ) {
    throw new Error(
      `Selected question does not match the explicit media fixture: ${JSON.stringify(files)}`
    );
  }
}

/** Common wire fields only: answers and other role-specific fields are checked by the caller. */
export function assertMediaQuestionData(
  payload: GameQuestionDataEventPayload,
  questionId: number,
  expectedFiles: readonly PackageQuestionFileDTO[]
): void {
  if (payload?.data?.id !== questionId) {
    throw new Error(
      `Question data expected questionId=${questionId}, received ${JSON.stringify(payload)}`
    );
  }
  const actualFiles = payload.data.questionFiles ?? [];
  if (!isDeepStrictEqual(actualFiles, expectedFiles)) {
    throw new Error(
      `Question data files mismatch: expected ${JSON.stringify(expectedFiles)}, received ${JSON.stringify(actualFiles)}`
    );
  }
  for (const { file } of actualFiles) {
    if (!file.md5 || !file.link || !/^https?:\/\//.test(file.link)) {
      throw new Error(
        `Question media must include a filename and HTTP(S) link: ${JSON.stringify(file)}`
      );
    }
  }
  assertFreshTimer(payload.timer, MEDIA_DOWNLOAD_TIMEOUT, "question data");
}

export function assertMediaDownloadStatus(
  status: MediaDownloadStatusBroadcastData,
  playerId: number,
  allPlayersReady: boolean,
  /** Expected question timer; defaults to content timeline + answer window */
  timerDurationMs: number | null = allPlayersReady ? questionTimerFor(status) : null
): void {
  if (
    status?.playerId !== playerId ||
    status.mediaDownloaded !== true ||
    status.allPlayersReady !== allPlayersReady
  ) {
    throw new Error(
      `expected playerId=${playerId}, mediaDownloaded=true, allPlayersReady=${allPlayersReady}; received ${JSON.stringify(status)}`
    );
  }
  if (timerDurationMs === null) {
    if (status.timer !== null) {
      throw new Error(
        `Partial media readiness expected timer=null, received ${JSON.stringify(status.timer)}`
      );
    }
  } else {
    assertFreshTimer(status.timer, timerDurationMs, "final media readiness");
    if (status.contentPlan === undefined) {
      throw new Error(
        `Final media readiness expected a contentPlan (object or null), received ${JSON.stringify(status)}`
      );
    }
  }
}

/**
 * Question timer for the scenario fixture question (one image file, no
 * displayTime): the image step, then the answer window.
 */
export const IMAGE_QUESTION_TIMER_MS = CONTENT_IMAGE_TIME + GAME_QUESTION_ANSWER_TIME;

/** Question timer implied by a completion status: content timeline + answer window. */
export function questionTimerFor(status: MediaDownloadStatusBroadcastData): number {
  const contentMs = status.contentPlan?.totalMs ?? 0;
  const opensAtMs = status.buzzerOpensAtMs ?? 0;
  return GAME_QUESTION_ANSWER_TIME + Math.max(contentMs, opensAtMs);
}

export function assertFreshTimer(
  timer: GameStateTimerDTO | null | undefined,
  expectedDurationMs: number,
  operation: string
): void {
  const startedAt = timer?.startedAt;
  const startedAtMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(String(startedAt));
  if (
    !timer ||
    timer.durationMs !== expectedDurationMs ||
    timer.elapsedMs !== 0 ||
    timer.resumedAt !== null ||
    Number.isNaN(startedAtMs)
  ) {
    throw new Error(
      `${operation} expected a fresh ${expectedDurationMs}ms timer, received ${JSON.stringify(timer)}`
    );
  }
}
