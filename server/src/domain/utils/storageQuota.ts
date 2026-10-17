import { PackageFileType } from "domain/enums/package/PackageFileType";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

/** Each distinct media filename used by a package, including its logo and choice answers. */
export function collectPackageFiles(content: PackageDTO): Map<string, PackageFileType> {
  const fileKinds = new Map<string, PackageFileType>();
  const addFile = (file: PackageFileDTO | null | undefined): void => {
    if (!file?.md5) {
      return;
    }

    const kind =
      file.type === PackageFileType.AUDIO || file.type === PackageFileType.VIDEO
        ? file.type
        : PackageFileType.IMAGE;
    fileKinds.set(file.md5, kind);
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

        for (const answer of question.answers ?? []) {
          addFile(answer.file);
        }
      }
    }
  }

  return fileKinds;
}

/** Human-readable sizes for storage-limit errors. */
export function formatBytes(bytes: number): string {
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;
  const gigabyte = megabyte * 1024;

  if (bytes < megabyte) {
    return `${Math.max(1, Math.round(bytes / kilobyte))} KB`;
  }

  if (bytes < gigabyte) {
    return `${(bytes / megabyte).toFixed(1).replace(/\.0$/, "")} MB`;
  }

  return `${(bytes / gigabyte).toFixed(2).replace(/\.?0+$/, "")} GB`;
}
