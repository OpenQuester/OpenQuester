import { describe, expect, it } from "@jest/globals";

import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { File } from "infrastructure/database/models/File";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";

const urls = { getUrl: (filename: string) => `https://files.test/${filename}` } as IFileUrlBuilder;

describe("PackageAnswerFile.toDTO", () => {
  it("keeps placement and waitForFinish, so answer timelines play background audio", () => {
    const file = new File();
    file.id = 7;
    file.filename = "0123456789abcdef0123456789abcdef";

    const answerFile = new PackageAnswerFile();
    answerFile.import({
      file,
      order: 0,
      type: PackageFileType.AUDIO,
      display_time: null,
      placement: ContentPlacement.BACKGROUND,
      wait_for_finish: false,
      question: new PackageQuestion()
    });

    const dto = answerFile.toDTO(urls, { fetchIds: false });

    expect(dto.placement).toBe(ContentPlacement.BACKGROUND);
    expect(dto.waitForFinish).toBe(false);
  });
});
