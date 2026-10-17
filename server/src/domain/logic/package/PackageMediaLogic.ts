import { type PackageDTO } from "domain/types/dto/package/PackageDTO";

/** The kind of media file, which decides the per-file storage limit that applies. */
export type MediaKind = "image" | "audio" | "video";

interface MediaFileRef {
  md5?: string;
  type?: string;
}

/** Reads which media files a package uses. */
export class PackageMediaLogic {
  /**
   * Every file the package content references, keyed by its stored name (an
   * MD5, sometimes with an extension), with its media kind: the logo, the
   * question and answer files of every question, and choice answer images.
   */
  public static collectFiles(content: PackageDTO): Map<string, MediaKind> {
    const files = new Map<string, MediaKind>();

    const add = (file: MediaFileRef | null | undefined) => {
      if (!file?.md5) {
        return;
      }

      files.set(file.md5, this._kindOf(file.type));
    };

    add(content.logo?.file);

    for (const round of content.rounds ?? []) {
      for (const theme of round.themes ?? []) {
        for (const question of theme.questions ?? []) {
          for (const questionFile of question.questionFiles ?? []) {
            add(questionFile.file);
          }

          for (const answerFile of question.answerFiles ?? []) {
            add(answerFile.file);
          }

          // Choice questions: an answer option can be a picture
          const answers = (question as { answers?: { file?: MediaFileRef | null }[] }).answers;
          for (const answer of answers ?? []) {
            add(answer.file);
          }
        }
      }
    }

    return files;
  }

  private static _kindOf(type: string | undefined): MediaKind {
    if (type === "audio" || type === "video") {
      return type;
    }

    return "image";
  }
}
