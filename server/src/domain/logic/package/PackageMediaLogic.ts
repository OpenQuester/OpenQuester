import { PackageFileType } from "domain/enums/package/PackageFileType";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

/** Reads which media files a package uses. */
export class PackageMediaLogic {
  /**
   * Every file the package content references, keyed by its stored name (an
   * MD5, sometimes with an extension), with its media kind: the logo, the
   * question and answer files of every question, and choice answer images.
   */
  public static collectFiles(content: PackageDTO): Map<string, PackageFileType> {
    const files = new Map<string, PackageFileType>();

    const addFile = (file: PackageFileDTO | null | undefined): void => {
      if (!file?.md5) {
        return;
      }

      const kind =
        file.type === PackageFileType.AUDIO || file.type === PackageFileType.VIDEO
          ? file.type
          : PackageFileType.IMAGE;
      files.set(file.md5, kind);
    };

    addFile(content.logo?.file);

    for (const round of content.rounds ?? []) {
      for (const theme of round.themes ?? []) {
        for (const question of theme.questions ?? []) {
          for (const questionFile of question.questionFiles ?? []) {
            addFile(questionFile.file);
          }

          for (const answerFile of question.answerFiles ?? []) {
            addFile(answerFile.file);
          }

          // Choice questions: an answer option can be a picture
          for (const answer of question.answers ?? []) {
            addFile(answer.file);
          }
        }
      }
    }

    return files;
  }
}
