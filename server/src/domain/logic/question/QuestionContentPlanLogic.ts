import {
  CONTENT_IMAGE_TIME,
  CONTENT_ITEM_MAX_TIME,
  CONTENT_MEDIA_UNKNOWN_TIME,
  CONTENT_TEXT_MAX_TIME,
  CONTENT_TEXT_MIN_TIME,
  CONTENT_TEXT_MS_PER_CHAR
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import {
  QuestionContentItemKind,
  QuestionContentPlanDTO,
  QuestionContentStepDTO
} from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import type {
  ContentDefaults,
  ContentPlanEntry,
  MediaDurations,
  OrderedContentPlanEntry,
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
 * an item that waits for its finish. A step lasts as long as its longest item,
 * except background sounds that do not wait (they keep playing underneath).
 */
export class QuestionContentPlanLogic {
  public static build(
    source: QuestionContentSource,
    mediaDurations: MediaDurations | null = null,
    defaults: ContentDefaults = QUESTION_DEFAULTS
  ): QuestionContentPlanDTO | null {
    const entries: OrderedContentPlanEntry[] = [];

    for (const file of source.files ?? []) {
      const placement =
        file.file.type === PackageFileType.AUDIO && file.placement === ContentPlacement.BACKGROUND
          ? ContentPlacement.BACKGROUND
          : ContentPlacement.SCREEN;

      entries.push({
        item: {
          kind: QuestionContentItemKind.FILE,
          order: file.order,
          placement,
          durationMs: this._fileDuration(file, mediaDurations, defaults)
        },
        waitForFinish: file.waitForFinish ?? true,
        sortKey: file.order,
        tieBreak: 1
      });
    }

    const text = source.text?.trim();
    if (text && source.textOrder !== null && source.textOrder !== undefined) {
      entries.push({
        item: {
          kind: QuestionContentItemKind.TEXT,
          order: source.textOrder,
          placement: ContentPlacement.SCREEN,
          durationMs: this.textDuration(text)
        },
        waitForFinish: true,
        sortKey: source.textOrder,
        tieBreak: 0
      });
    }

    for (const item of source.textItems ?? []) {
      const text = item.text.trim();
      if (!text) continue;
      entries.push({
        item: {
          kind: QuestionContentItemKind.TEXT,
          order: item.order,
          placement: ContentPlacement.SCREEN,
          durationMs: this.textDuration(text)
        },
        waitForFinish: true,
        sortKey: item.order,
        tieBreak: 0
      });
    }

    if (entries.length === 0) {
      return null;
    }

    entries.sort((a, b) => a.sortKey - b.sortKey || a.tieBreak - b.tieBreak);

    const steps: QuestionContentStepDTO[] = [];
    let current: ContentPlanEntry[] = [];
    let cursor = 0;

    const close = () => {
      if (current.length === 0) {
        return;
      }

      const blocking = current.filter(
        (e) => e.waitForFinish || e.item.placement !== ContentPlacement.BACKGROUND
      );
      const durationMs = Math.max(0, ...blocking.map((e) => e.item.durationMs));

      steps.push({
        startMs: cursor,
        durationMs,
        items: current.map((e) => e.item)
      });
      cursor += durationMs;
      current = [];
    };

    for (const entry of entries) {
      current.push(entry);

      if (entry.waitForFinish) {
        close();
      }
    }

    close();

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
            textOrder: question.textOrder,
            textItems: question.textItems,
            files: question.questionFiles
          },
          game.gameState.mediaDurations ?? null
        )
      : null;

    game.gameState.questionContentPlan = plan;
    game.gameState.buzzerOpensAtMs = this.buzzerOpensAt(game);

    return plan?.totalMs ?? 0;
  }

  /**
   * When the buzzer opens, as a position on the SHOWING timer: after the
   * content timeline, after the reading time of a caption text (text shown
   * the whole time rather than as a step), plus a choice question's options
   * delay. `answerDelay` is not used: editors default it to 5 s and present it
   * as an answer window, so honouring it would slow every question down.
   * 0 when the game allows pressing at any time (`falseStart` off).
   */
  public static buzzerOpensAt(game: Game): number {
    const question = game.gameState.currentQuestion;
    if (!question || !game.settings.falseStart) {
      return 0;
    }

    const contentMs = game.gameState.questionContentPlan?.totalMs ?? 0;
    const caption = question.text?.trim();
    const isCaption =
      !!caption && (question.textOrder === null || question.textOrder === undefined);
    const readingMs = isCaption ? this.textDuration(caption) : 0;

    // Choice options appear showDelay after the question, then the buzzer
    const optionsMs =
      question.type === PackageQuestionType.CHOICE ? Math.max(0, question.showDelay ?? 0) : 0;

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

    return Math.max(contentMs, opensAtMs) + answerMs;
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
    reported: MediaDurationReport[] | null | undefined
  ): void {
    if (!reported?.length) {
      return;
    }

    const known = new Set(
      (game.gameState.currentQuestion?.questionFiles ?? []).map((f) => f.file.md5)
    );
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
