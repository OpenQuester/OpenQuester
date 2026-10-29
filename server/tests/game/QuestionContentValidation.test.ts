import { describe, expect, it } from "@jest/globals";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { PackageUtils } from "tests/utils/PackageUtils";

function fixture() {
  const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" });
  const q = content.rounds[0].themes[0].questions[0];
  q.answerType = AnswerType.POINT;
  q.answerPoint = { x: 0.2, y: 0.4, imageAspectRatio: 1.5 };
  q.text = "Main";
  q.textOrder = 0;
  q.questionFiles = [
    { order: 1, displayTime: 5000, file: { md5: "a".repeat(32), type: PackageFileType.IMAGE } },
    { order: 3, displayTime: 5000, file: { md5: "b".repeat(32), type: PackageFileType.IMAGE } }
  ];
  return { content, q };
}
const validate = (content: ReturnType<typeof fixture>["content"]) =>
  uploadPackageScheme().validate({ content }, { allowUnknown: true });

describe("question content validation and projection", () => {
  it("accepts valid explicit metadata and preserves legacy absence and text/file ties", () => {
    const { content, q } = fixture();
    q.pointImageOrder = 3;
    q.textItems = [
      { order: 2, text: " Next step " },
      { order: 4, text: "Final" }
    ];
    const result = validate(content);
    expect(result.error).toBeUndefined();
    expect(result.value.content.rounds[0].themes[0].questions[0].textItems[0].text).toBe(
      " Next step "
    );
    q.pointImageOrder = null;
    q.textItems = null;
    q.textOrder = 1;
    expect(validate(content).error).toBeUndefined();
  });

  it("rejects missing, non-image, ambiguous, fractional and negative point orders", () => {
    const { content, q } = fixture();
    for (const order of [-1, 0.5, 2, 2147483648]) {
      q.pointImageOrder = order;
      expect(validate(content).error).toBeDefined();
    }
    q.pointImageOrder = 3;
    q.questionFiles![1].file.type = PackageFileType.VIDEO;
    expect(validate(content).error).toBeDefined();
    q.questionFiles![1].file.type = PackageFileType.IMAGE;
    q.questionFiles!.push({
      order: 3,
      displayTime: 1000,
      file: { md5: "c".repeat(32), type: PackageFileType.AUDIO }
    });
    expect(validate(content).error).toBeDefined();
  });

  it("rejects empty, duplicated and colliding additional text orders", () => {
    const { content, q } = fixture();
    for (const items of [
      [{ order: 2, text: " " }],
      [{ order: -1, text: "bad" }],
      [{ order: 2.5, text: "bad" }],
      [
        { order: 2, text: "one" },
        { order: 2, text: "two" }
      ],
      [{ order: 1, text: "file collision" }],
      [{ order: 0, text: "main text collision" }]
    ]) {
      q.textItems = items;
      expect(validate(content).error).toBeDefined();
    }
    q.textItems = [{ order: 2, text: "allowed" }];
    expect(validate(content).error).toBeUndefined();
  });

  it("rejects duplicate file and main-text orders only for the new sequence format", () => {
    const { content, q } = fixture();
    q.textItems = [];
    q.textOrder = 1;
    expect(validate(content).error).toBeDefined();
    q.textOrder = 0;
    q.questionFiles![1].order = 1;
    expect(validate(content).error).toBeDefined();
    q.textItems = null;
    expect(validate(content).error).toBeUndefined();
  });

  it("makes image order and text steps public without exposing the correct answer", () => {
    const { q } = fixture();
    q.pointImageOrder = 3;
    q.textItems = [{ order: 2, text: "Question step" }];
    const visible = GameQuestionMapper.mapToSimpleQuestion(q);
    expect(visible).toMatchObject({ pointImageOrder: 3, textItems: q.textItems });
    expect(visible).not.toHaveProperty("answerPoint");
    expect(visible).not.toHaveProperty("answerText");
  });

  it("requires measured audio and video durations only for sequenced final questions", () => {
    const content = new PackageUtils().createTestPackageData({ id: 1, username: "author" }, true);
    const final = content.rounds[1].themes[0].questions[0];
    final.textItems = [];
    final.questionFiles = [
      { order: 1, displayTime: null, file: { md5: "a".repeat(32), type: PackageFileType.VIDEO } }
    ];
    for (const duration of [null, 0, -1, 0.5, 120001]) {
      final.questionFiles[0].displayTime = duration;
      expect(validate(content).error).toBeDefined();
    }
    for (const duration of [1, 31000, 120000]) {
      final.questionFiles[0].displayTime = duration;
      expect(validate(content).error).toBeUndefined();
    }
    final.questionFiles[0].file.type = PackageFileType.AUDIO;
    final.questionFiles[0].displayTime = null;
    expect(validate(content).error).toBeDefined();
    final.textItems = null;
    expect(validate(content).error).toBeUndefined();
  });
});
