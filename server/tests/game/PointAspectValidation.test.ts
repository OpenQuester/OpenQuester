import { describe, expect, it } from "@jest/globals";
import { AnswerType } from "domain/enums/package/AnswerType";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { PackageUtils } from "tests/utils/PackageUtils";

describe("point aspect validation", () => {
  it.each([0, -1, Infinity, NaN])("rejects nonpositive or nonfinite aspect %s", (aspect) => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
    const question = content.rounds[0].themes[0].questions[0];
    question.answerType = AnswerType.POINT;
    question.answerPoint = { x: 0.5, y: 0.5, imageAspectRatio: aspect };
    expect(uploadPackageScheme().validate({ content }, { allowUnknown: true }).error).toBeDefined();
  });
  it("accepts a positive aspect and a legacy point without it", () => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
    const question = content.rounds[0].themes[0].questions[0];
    question.answerType = AnswerType.POINT;
    question.answerPoint = { x: 0.5, y: 0.5, imageAspectRatio: 0.5 };
    expect(uploadPackageScheme().validate({ content }, { allowUnknown: true }).error).toBeUndefined();
    question.answerPoint = { x: 0.5, y: 0.5 };
    expect(uploadPackageScheme().validate({ content }, { allowUnknown: true }).error).toBeUndefined();
  });
});
