import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { answerFormat } from "domain/logic/question/answerFormat";
import {
  CONTENT_IMAGE_TIME,
  CONTENT_ITEM_MAX_TIME,
  CONTENT_MEDIA_UNKNOWN_TIME,
  CONTENT_TEXT_MAX_TIME,
  CONTENT_TEXT_MIN_TIME,
  CONTENT_TEXT_MS_PER_CHAR
} from "domain/constants/game";
import { answerWindowDuration } from "domain/logic/question/answerWindowDuration";
import { authoredContentGroups } from "domain/logic/question/authoredContentGroups";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { Game } from "domain/entities/game/Game";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import {
  QuestionContentItemKind,
  QuestionContentPlanDTO,
  QuestionContentStepDTO
} from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import type {
  ContentDefaults,
  MediaDurations,
  QuestionContentSource
} from "domain/types/question/QuestionContentPlanTypes";
import type { MediaDurationReport } from "domain/types/socket/events/game/MediaDownloadedInputData";

const QUESTION_DEFAULTS: ContentDefaults = {
  imageMs: CONTENT_IMAGE_TIME,
  audioMs: CONTENT_MEDIA_UNKNOWN_TIME,
  videoMs: CONTENT_MEDIA_UNKNOWN_TIME
};

/**
 * Builds the content timeline of a question or answer, following SIGame:
 * items play in order, and consecutive items are grouped into one step until
 * an item that waits for its finish. Queue offsets schedule files within a
 * step. Background sounds that do not wait keep playing underneath.
 */
export class QuestionContentPlanLogic {
  /** All ask modes wait for readiness, the start lead and the actual authored plan. */
  public static isPresentationComplete(
    game: Game,
    presentationMs = this.presentationDuration(game)
  ): boolean {
    const timer = game.gameState.timer;
    if (!timer) {
      return presentationMs === 0;
    }
    const now = Date.now();
    if (GamePauseLogic.startDelayMs(timer, now) > 0) {
      return false;
    }
    const elapsed = game.gameState.isPaused
      ? (timer.elapsedMs ?? 0)
      : GamePauseLogic.calculateElapsedTime(timer, now);
    return elapsed >= presentationMs;
  }

  private static presentationDuration(game: Game): number {
    const contentMs = game.gameState.questionContentPlan?.totalMs ?? 0;
    return this.selectionWaitsForPresentation(game)
      ? Math.max(contentMs, this.buzzerOpensAt(game))
      : contentMs;
  }

  public static build(
    source: QuestionContentSource,
    mediaDurations: MediaDurations | null = null,
    defaults: ContentDefaults = QUESTION_DEFAULTS
  ): QuestionContentPlanDTO | null {
    const groups = authoredContentGroups(source);
    const captionMs =
      source.textOrder == null && source.text?.trim() && (source.answerDurationMs ?? 0) > 0
        ? (source.textDurationMs ?? this.textDuration(source.text))
        : 0;
    if (groups.length === 0 && !captionMs) {
      return null;
    }

    let cursor = 0;
    const steps: QuestionContentStepDTO[] = groups.map((group) => {
      const visualCount = group.filter(
        (entry) => "media" in entry && entry.media.file.type !== PackageFileType.AUDIO
      ).length;
      const forceQueue = visualCount >= 5;
      let offset = 0;
      let durationMs = 0;
      const items = group.map((entry) => {
        const { order } = entry;
        if ("text" in entry) {
          const duration = entry.durationMs ?? this.textDuration(entry.text);
          durationMs = Math.max(durationMs, duration);
          return {
            kind: QuestionContentItemKind.TEXT,
            order,
            placement:
              entry.placement === "replic" ? ContentPlacement.REPLIC : ContentPlacement.SCREEN,
            durationMs: duration
          };
        }

        const file = entry.media;
        const type = file.file.type;
        const background =
          type === PackageFileType.AUDIO && file.placement === ContentPlacement.BACKGROUND;
        const duration = this._fileDuration(file, mediaDurations, defaults);
        const queued =
          !background &&
          (forceQueue ||
            (source.playMediaSimultaneously === false && type !== PackageFileType.IMAGE));
        const startOffsetMs = queued ? offset : 0;
        if (queued) {
          offset += duration;
        }
        if (!background || file.waitForFinish !== false) {
          durationMs = Math.max(durationMs, startOffsetMs + duration);
        }
        return {
          kind: QuestionContentItemKind.FILE,
          order,
          placement: background ? ContentPlacement.BACKGROUND : ContentPlacement.SCREEN,
          durationMs: duration,
          ...(startOffsetMs > 0 ? { startOffsetMs } : {})
        };
      });
      const step = { startMs: cursor, durationMs, items };
      cursor += durationMs;
      return step;
    });

    if (captionMs > cursor) {
      steps.push({ startMs: cursor, durationMs: captionMs - cursor, items: [] });
      cursor = captionMs;
    }
    return { steps, totalMs: cursor };
  }

  /**
   * Builds and stores the question timeline on the game.
   * @returns timeline length in ms (0 when the question has nothing to sequence)
   */
  public static applyToGame(game: Game): number {
    const question = game.gameState.currentQuestion;

    const plan = question
      ? this.build(
          {
            text: question.text,
            answerDurationMs: question.answerDurationMs,
            textOrder: question.textOrder,
            textItems: question.textItems,
            textDurationMs: question.textDurationMs,
            textWaitForFinish: question.textWaitForFinish,
            playMediaSimultaneously: question.playMediaSimultaneously,
            files: question.questionFiles
          },
          game.gameState.mediaDurations ?? null
        )
      : null;

    game.gameState.questionContentPlan = plan;
    game.gameState.buzzerOpensAtMs = this.buzzerOpensAt(game);

    return plan?.totalMs ?? 0;
  }

  /** These selections use the presentation timer because the player does not buzz first. */
  public static selectionWaitsForPresentation(game: Game): boolean {
    const { currentQuestion: question, allPlay } = game.gameState;
    return (
      answerFormat(question) === AnswerType.SELECT &&
      (!!allPlay ||
        question?.type === PackageQuestionType.STAKE ||
        question?.type === PackageQuestionType.SECRET)
    );
  }

  /**
   * When the buzzer opens, as a position on the SHOWING timer: after the
   * content timeline, after the reading time of a caption text (text shown
   * the whole time rather than as a step), plus a choice question's options
   * delay. `answerDelay` is not used: editors default it to 5 s and present it
   * as an answer window, so honouring it would slow every question down.
   * Ordinary buzzers return 0 when `falseStart` is off. Direct/all-play select
   * still waits for presentation and option delay before accepting a selection.
   */
  public static buzzerOpensAt(game: Game): number {
    const question = game.gameState.currentQuestion;
    if (!question || (!game.settings.falseStart && !this.selectionWaitsForPresentation(game))) {
      return 0;
    }

    const contentMs = game.gameState.questionContentPlan?.totalMs ?? 0;
    const caption = question.text?.trim();
    const isCaption =
      !!caption && (question.textOrder === null || question.textOrder === undefined);
    const readingMs = isCaption ? (question.textDurationMs ?? this.textDuration(caption)) : 0;

    // Choice options appear showDelay after the question, then the buzzer
    const optionsMs =
      answerFormat(question) === AnswerType.SELECT ? Math.max(0, question.showDelay ?? 0) : 0;

    return Math.max(contentMs, readingMs) + optionsMs;
  }

  /**
   * Question timer length: the content plays and the buzzer opens first,
   * then the usual answer window.
   */
  public static questionTimerDuration(game: Game): number {
    const contentMs = game.gameState.questionContentPlan?.totalMs ?? 0;
    const opensAtMs = game.gameState.buzzerOpensAtMs ?? 0;
    const timers = game.settings.timers;
    const answerMs = game.gameState.allPlay ? timers.allPlayAnswerMs : timers.answerMs;

    return (
      Math.max(contentMs, opensAtMs) +
      answerWindowDuration(game.gameState.currentQuestion, answerMs)
    );
  }

  public static textDuration(text: string): number {
    return Math.min(
      CONTENT_TEXT_MAX_TIME,
      Math.max(CONTENT_TEXT_MIN_TIME, text.length * CONTENT_TEXT_MS_PER_CHAR)
    );
  }

  /**
   * Merges a client's reported media lengths. The longest report wins so
   * nobody's playback gets cut; values are clamped to the item cap.
   */
  public static mergeMediaDurations(
    game: Game,
    reported: MediaDurationReport[] | null | undefined,
    files = game.gameState.currentQuestion?.questionFiles
  ): void {
    if (!reported?.length) {
      return;
    }

    const known = new Set((files ?? []).map((f) => f.file.md5));
    const durations: MediaDurations = { ...(game.gameState.mediaDurations ?? {}) };

    for (const { md5, durationMs } of reported) {
      if (!known.has(md5) || !Number.isFinite(durationMs) || durationMs <= 0) {
        continue;
      }

      const clamped = Math.min(CONTENT_ITEM_MAX_TIME, Math.round(durationMs));
      durations[md5] = Math.max(durations[md5] ?? 0, clamped);
    }

    game.gameState.mediaDurations = durations;
  }

  private static _fileDuration(
    file: PackageQuestionFileDTO,
    mediaDurations: MediaDurations | null,
    defaults: ContentDefaults
  ): number {
    if (file.displayTime && file.displayTime > 0) {
      return Math.min(CONTENT_ITEM_MAX_TIME, file.displayTime);
    }

    switch (file.file.type) {
      case PackageFileType.AUDIO:
      case PackageFileType.VIDEO: {
        const reported = file.file.md5 ? mediaDurations?.[file.file.md5] : undefined;
        if (reported && reported > 0) {
          return Math.min(CONTENT_ITEM_MAX_TIME, reported);
        }

        return file.file.type === PackageFileType.AUDIO ? defaults.audioMs : defaults.videoMs;
      }

      case PackageFileType.IMAGE:
      default:
        return defaults.imageMs;
    }
  }
}
