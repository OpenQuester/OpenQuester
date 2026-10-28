import { describe, expect, it } from "@jest/globals";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { PackageUtils } from "tests/utils/PackageUtils";

describe("authored choice key validation", () => {
  it("accepts order zero, nonconsecutive orders and absent legacy keys", () => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
    const q = content.rounds[0].themes
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    q.answers![1].order = 8;
    for (const key of [undefined, null, 0, 8]) {
      q.correctChoiceOrder = key;
      expect(
        uploadPackageScheme().validate({ content }, { allowUnknown: true }).error
      ).toBeUndefined();
    }
  });

  it("rejects unmatched, fractional and duplicate referenced orders", () => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
    const q = content.rounds[0].themes
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    for (const key of [99, 0.5]) {
      q.correctChoiceOrder = key;
      expect(
        uploadPackageScheme().validate({ content }, { allowUnknown: true }).error
      ).toBeDefined();
    }
    q.correctChoiceOrder = 0;
    q.answers![1].order = 0;
    expect(uploadPackageScheme().validate({ content }, { allowUnknown: true }).error).toBeDefined();
  });

  it("does not publish an unresolved editor archive as a legacy question", () => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
    const q = content.rounds[0].themes
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    Object.assign(q, { correctChoiceNeedsRepair: true });
    expect(uploadPackageScheme().validate({ content }, { stripUnknown: true }).error).toBeDefined();
  });
});
