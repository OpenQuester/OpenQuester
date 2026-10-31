import { strToU8, zipSync, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { md5Hex, readZip } from "./archive";
import {
  HtmlConfirmationRequiredError,
  PackageImportCancelledError,
  type HtmlRemovalReport,
} from "./htmlRemoval";
import { parseOq } from "./oq";
import { parseSiq } from "./siq";
import { readPackageFile, contentHash } from "./upload";

const bytes = (s: string) => new Uint8Array(strToU8(s));
const file = (name: string, entries: Record<string, Uint8Array>) => {
  const zip = zipSync(entries);
  return {
    name,
    arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
  } as File;
};
const normal = (price: number, text: string) =>
  `<question price="${price}"><scenario><atom>${text}</atom></scenario><right><answer>A</answer></right></question>`;
const theme = (name: string, questions: string) =>
  `<themes><theme name="${name}"><questions>${questions}</questions></theme></themes>`;
const xml = `<package xmlns="urn:siq" name="Pack"><rounds>
  <round name="Early" type="final">${theme("Normal", normal(100, "First") + normal(200, "Second"))}</round>
  <round name="Last">${theme("HTML", `<question price="300"><params><param name="answer"><item type="html" isRef="True">missing.html</item><item type="html">again</item></param></params></question>`)}</round>
</rounds></package>`;

describe("HTML import preflight", () => {
  it("requires consent before conversion and preserves original final classification", async () => {
    const input = file("test.siq", {
      "content.xml": bytes(xml),
      "Html/missing.html": bytes("<script>bad()</script>"),
    });
    let release!: (answer: boolean) => void;
    const confirm = vi.fn(
      (_report: HtmlRemovalReport) =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
    );
    const pending = readPackageFile(input, { confirmHtmlRemoval: confirm });
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      totalQuestions: 3,
      questions: [{ roundIndex: 1, themeIndex: 0, questionIndex: 0, price: "300" }],
    });
    release(true);
    const parsed = await pending;
    expect(parsed.content.rounds).toHaveLength(1);
    expect(parsed.content.rounds[0]).toMatchObject({
      type: "simple",
      themes: [{ questions: [{ price: 100 }, { price: 200 }] }],
    });
    expect(parsed.warnings.map((w) => w.code)).toContain("htmlQuestionRemoved");
    expect(parsed.files.size).toBe(0);
    const second = await readPackageFile(input, { confirmHtmlRemoval: async () => true });
    expect(contentHash(parsed)).toBe(contentHash(second));
  });
  it("refuses direct parsers and leaves the file untouched on cancellation", async () => {
    const entries = { "content.xml": bytes(xml) };
    await expect(parseSiq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    const input = file("test.siq", entries);
    await expect(
      readPackageFile(input, { confirmHtmlRemoval: async () => false }),
    ).rejects.toBeInstanceOf(PackageImportCancelledError);
  });
  it("distinguishes text and ordinary image references from structural HTML", async () => {
    const body = `<question price="1"><scenario><atom><![CDATA[<b>safe</b>]]></atom><atom type="image">@same.png</atom></scenario></question>
    <question price="2"><scenario><atom type="image">@HTML/%D0%A2%D0%B5%D1%81%D1%82.html</atom></scenario></question>
    <question price="3"><type name="html"/></question>`;
    const source = `<package><rounds><round>${theme("T", body)}</round></rounds></package>`;
    const input = file("test.siq", {
      "content.xml": bytes(source),
      "Images/same.png": new Uint8Array([1]),
      "Html/same.png": new Uint8Array([2]),
      "html/%D0%A2%D0%B5%D1%81%D1%82.html": bytes("x"),
      "Html/orphan.html": bytes("x"),
    });
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => true);
    const parsed = await readPackageFile(input, { confirmHtmlRemoval: confirm });
    expect(confirm.mock.calls[0]![0].questions).toHaveLength(2);
    expect(parsed.content.rounds[0]!.themes[0]!.questions[0]!.text).toBe("<b>safe</b>");
    expect(parsed.files.size).toBe(1);
  });
  it("rejects all-HTML content after reporting it", async () => {
    const source = `<package><rounds><round>${theme("T", '<question type="html"/>')}</round></rounds></package>`;
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => true);
    await expect(
      readPackageFile(file("x.siq", { "content.xml": bytes(source) }), {
        confirmHtmlRemoval: confirm,
      }),
    ).rejects.toThrow("allHtmlQuestions");
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("normalizes OQ structural order by original numeric order and retains shared media", async () => {
    const media = new Uint8Array([3, 4, 5]);
    const md5 = md5Hex(media);
    const q = (order: number, text: string, type = "simple") => ({
      order,
      text,
      type,
      price: order,
      questionFiles: [{ order: 7, file: { md5, type: "image" } }],
    });
    const json = {
      title: "OQ",
      rounds: [
        {
          name: "Later",
          order: 9,
          themes: [
            {
              name: "T",
              order: 0,
              questions: [q(8, "Later"), q(2, "Removed", "html"), q(1, "Earlier")],
            },
          ],
        },
        { name: "First", order: 1, themes: [{ name: "T", order: 0, questions: [q(0, "First")] }] },
      ],
    };
    const entries = { "content.json": bytes(JSON.stringify(json)), [`files/${md5}`]: media };
    await expect(parseOq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    const parsed = await readPackageFile(file("test.oq", entries), {
      confirmHtmlRemoval: async () => true,
    });
    const rounds = [...parsed.content.rounds].sort((a, b) => a.order - b.order);
    expect(rounds.map((r) => r.name)).toEqual(["First", "Later"]);
    const questions = [...rounds[1]!.themes[0]!.questions].sort((a, b) => a.order - b.order);
    expect(questions.map((q) => q.text)).toEqual(["Earlier", "Later"]);
    expect(questions[0]!.questionFiles![0]!.order).toBe(7);
    expect(parsed.files.has(md5)).toBe(true);
  });
  it("refuses malformed input and detects HTML in OQ choice/answer attachments", async () => {
    const q = (file: unknown) => ({
      type: "choice",
      answers: [{ file }],
      questionFiles: [],
      answerFiles: [],
    });
    const json = {
      rounds: [
        { themes: [{ questions: [q({ type: "html" }), { type: "simple", text: "keep" }] }] },
      ],
    };
    const entries = { "content.json": bytes(JSON.stringify(json)) };
    await expect(parseOq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    await expect(readPackageFile(file("bad.oq", { "content.json": bytes("{") }))).rejects.toThrow(
      "badContentJson",
    );
    await expect(parseSiq(unzipSync(zipSync({ "content.xml": bytes("<bad") })))).rejects.toThrow(
      "badContentXml",
    );
  });
  it("rejects ambiguous manifest aliases before consent and accepts a single encoded name", async () => {
    const harmless = `<package><rounds><round>${theme("T", normal(1, "safe"))}</round></rounds></package>`;
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => false);
    const aliases: Record<string, Uint8Array>[] = [
      { "CONTENT.XML": bytes(harmless), "content.xml": bytes(xml) },
      { "content.xml": bytes(xml), "CONTENT.XML": bytes(harmless) },
      { "CONTENT.XML": bytes(harmless), "Content.Xml": bytes(xml) },
    ];
    for (const entries of aliases) {
      await expect(
        readPackageFile(file("alias.siq", entries), { confirmHtmlRemoval: confirm }),
      ).rejects.toThrow("ambiguousManifest");
    }
    expect(confirm).not.toHaveBeenCalled();
    const encoded = file("encoded.siq", { "content%2Exml": bytes(xml) });
    await expect(readPackageFile(encoded, { confirmHtmlRemoval: confirm })).rejects.toBeInstanceOf(
      PackageImportCancelledError,
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it("ignores attributes in untrusted XML that resemble internal bookkeeping", async () => {
    const source = `<package><rounds><round type="final" data-original-nonlast-final="true">${theme("T", normal(1, "One") + normal(2, "Two"))}</round></rounds></package>`;
    const parsed = await parseSiq({ "content.xml": bytes(source) });
    expect(parsed.content.rounds[0]!.type).toBe("final");
    expect(parsed.content.rounds[0]!.themes[0]!.questions).toHaveLength(1);
  });

  it("does not decompress invalid media before the decision", async () => {
    const archive = zipSync({ "content.xml": bytes(xml), "media.bin": bytes("a".repeat(5000)) });
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const compressed = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const start = offset + 30 + nameLength + extraLength;
      const name = new TextDecoder().decode(
        archive.subarray(offset + 30, offset + 30 + nameLength),
      );
      if (name === "media.bin") archive.fill(255, start, start + compressed);
      offset = start + compressed;
    }
    await expect(readZip(archive)).rejects.toThrow("notZip");
    const input = {
      name: "x.siq",
      arrayBuffer: async () =>
        archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
    } as File;
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => false);
    await expect(readPackageFile(input, { confirmHtmlRemoval: confirm })).rejects.toBeInstanceOf(
      PackageImportCancelledError,
    );
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("keeps numeric-string structural order at every OQ level", async () => {
    const question = (order: string, text: string) => ({ order, text, type: "simple" });
    const themeData = (order: string, name: string) => ({
      order,
      name,
      questions: [question("20", "later"), { order: 30, type: "html" }, question("10", "earlier")],
    });
    const json = {
      rounds: [
        {
          name: "later round",
          order: "20",
          themes: [
            themeData("20", "later theme"),
            { name: "removed theme", order: "30", questions: [{ type: "html" }] },
            themeData("10", "earlier theme"),
          ],
        },
        { name: "removed", order: "30", themes: [{ questions: [{ type: "html" }] }] },
        { name: "earlier round", order: "10", themes: [themeData("0", "only")] },
      ],
    };
    const parsed = await parseOq({ "content.json": bytes(JSON.stringify(json)) }, true);
    const sorted = <T extends { order: number }>(items: T[]) =>
      [...items].sort((a, b) => a.order - b.order);
    const rounds = sorted(parsed.content.rounds);
    expect(rounds.map((r) => r.name)).toEqual(["earlier round", "later round"]);
    const themes = sorted(rounds[1]!.themes);
    expect(themes.map((t) => t.name)).toEqual(["earlier theme", "later theme"]);
    expect(sorted(themes[0]!.questions).map((q) => q.text)).toEqual(["earlier", "later"]);
  });
  it("rejects if the remaining SIQ questions disappear during conversion", async () => {
    const source = `<package><rounds><round>${theme("T", '<question type="html"/><question price="100"><scenario><atom type="image">@missing.png</atom></scenario></question>')}</round></rounds></package>`;
    await expect(parseSiq({ "content.xml": bytes(source) }, true)).rejects.toThrow(
      "allHtmlQuestions",
    );
    const noHtml = source.replace('<question type="html"/>', "");
    expect(
      (await parseSiq({ "content.xml": bytes(noHtml) })).content.rounds[0]!.themes[0]!.questions,
    ).toHaveLength(0);
  });
  it("does not hash orphan or removed-only OQ media", async () => {
    const content = {
      rounds: [
        {
          themes: [
            {
              questions: [
                { type: "simple", text: "keep" },
                { type: "html", questionFiles: [{ file: { type: "image", md5: "removed" } }] },
              ],
            },
          ],
        },
      ],
    };
    const parsed = await parseOq(
      {
        "content.json": bytes(JSON.stringify(content)),
        "files/removed": bytes("invalid hash"),
        "files/orphan": bytes("invalid hash"),
      },
      true,
    );
    expect(parsed.files.size).toBe(0);
    expect(parsed.warnings.map((w) => w.code)).toEqual(["htmlQuestionRemoved"]);
  });
  it("detects explicit Html paths used by media atoms without @", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom type="image">Html/x.html</atom></scenario></question><question><scenario><atom type="image">%40Html%2Fx.html</atom></scenario></question>' + normal(100, "keep"))}</round></rounds></package>`;
    const entries = { "content.xml": bytes(source), "Html/x.html": bytes("x") };
    await expect(parseSiq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    const result = await parseSiq(entries, true);
    expect(result.content.rounds[0]!.themes[0]!.questions).toHaveLength(1);
  });
  it.each([
    ["image", "ImAgEs"],
    ["audio", "AuDiO"],
    ["voice", "AuDiO"],
    ["video", "ViDeO"],
  ])("keeps a %s question when its real media target collides with Html/", async (kind, folder) => {
    const source = `<package><rounds><round>${theme("T", `<question price="100"><scenario><atom>normal</atom><atom type="${kind}">@hTmL/%D0%A2%D0%B5%D1%81%D1%82.png</atom></scenario><right><answer>A</answer></right></question>`)}</round></rounds></package>`;
    const media = new Uint8Array([1, 2, 3, 4]);
    const entries = {
      "content.xml": bytes(source),
      [`${folder}/HTML/%D0%A2%D0%B5%D1%81%D1%82.png`]: media,
      "Html/%D0%A2%D0%B5%D1%81%D1%82.png": bytes("unrelated"),
    };
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => true);
    const parsed = await readPackageFile(file("collision.siq", entries), {
      confirmHtmlRemoval: confirm,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(parsed.content.rounds[0]!.themes[0]!.questions).toHaveLength(1);
    expect(parsed.files.has(md5Hex(media))).toBe(true);
    expect((await parseSiq(entries)).files.has(md5Hex(media))).toBe(true);
  });
  it("still reports an Html reference if the type-folder target is empty", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom type="image">@Html/x.png</atom></scenario></question>' + normal(100, "keep"))}</round></rounds></package>`;
    const entries = {
      "content.xml": bytes(source),
      "Images/Html/x.png": new Uint8Array(),
      "Html/x.png": bytes("html"),
    };
    await expect(parseSiq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => false);
    await expect(
      readPackageFile(file("empty.siq", entries), { confirmHtmlRemoval: confirm }),
    ).rejects.toBeInstanceOf(PackageImportCancelledError);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("still reports explicit HTML despite a matching typed media target", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom type="image">@Html/x.png</atom><atom type="html">x</atom></scenario></question>' + normal(100, "keep"))}</round></rounds></package>`;
    await expect(
      parseSiq({
        "content.xml": bytes(source),
        "Images/Html/x.png": bytes("image"),
        "Html/x.png": bytes("unrelated"),
      }),
    ).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
  });
  it("uses the actual Images target instead of an unrelated Html file", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom>normal</atom><atom type="image">@Html/picture.png</atom></scenario><right><answer>A</answer></right></question>')}</round></rounds></package>`;
    const media = new Uint8Array([137, 80, 78, 71]);
    const entries = {
      "content.xml": bytes(source),
      "Images/Html/picture.png": media,
      "Html/picture.png": bytes("unrelated"),
    };
    const parsed = await readPackageFile(file("normal.siq", entries));
    expect(parsed.content.rounds[0]!.themes[0]!.questions[0]!.text).toBe("normal");
    expect(parsed.files.has(md5Hex(media))).toBe(true);
  });
  it("uses exact empty media precedence over a nonempty case alias", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom type="image">@Html/x.png</atom></scenario></question>' + normal(100, "keep"))}</round></rounds></package>`;
    const entries = {
      "content.xml": bytes(source),
      "Images/Html/x.png": new Uint8Array(),
      "images/html/x.png": bytes("other"),
      "Html/x.png": bytes("html"),
    };
    await expect(parseSiq(entries)).rejects.toBeInstanceOf(HtmlConfirmationRequiredError);
    await expect(readPackageFile(file("case.siq", entries))).rejects.toBeInstanceOf(
      HtmlConfirmationRequiredError,
    );
  });
  it("keeps HTML detection stable across three mixed-size aliases and honors exact matches", async () => {
    const suspect =
      '<question><scenario><atom>normal</atom><atom type="image">@Html/x.png</atom></scenario></question>';
    const source = `<package><rounds><round>${theme("T", suspect + '<question type="html"/>' + normal(100, "keep"))}</round></rounds></package>`;
    const aliases: [string, Uint8Array][] = [
      ["IMAGES/HTML/X.PNG", bytes("one")],
      ["Images/Html/X.png", new Uint8Array()],
      ["images/html/x.png", bytes("three")],
    ];
    for (const order of [
      [0, 1, 2],
      [2, 1, 0],
      [0, 2, 1],
    ]) {
      const entries = {
        "content.xml": bytes(source),
        "Html/x.png": bytes("html"),
        ...Object.fromEntries(order.map((i) => aliases[i]!)),
      };
      let report: HtmlRemovalReport | undefined;
      await expect(
        readPackageFile(file("aliases.siq", entries), {
          confirmHtmlRemoval: async (value) => {
            report = value;
            return false;
          },
        }),
      ).rejects.toBeInstanceOf(PackageImportCancelledError);
      expect(report!.questions.map((q) => q.questionIndex)).toEqual([0, 1]);
      await expect(parseSiq(entries)).rejects.toMatchObject({
        report: {
          questions: [
            expect.objectContaining({ questionIndex: 0 }),
            expect.objectContaining({ questionIndex: 1 }),
          ],
        },
      });
    }
    const exact = {
      "content.xml": bytes(source),
      "Html/x.png": bytes("html"),
      ...Object.fromEntries(aliases),
      "Images/Html/x.png": bytes("exact"),
    };
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => false);
    await expect(
      readPackageFile(file("exact.siq", exact), { confirmHtmlRemoval: confirm }),
    ).rejects.toBeInstanceOf(PackageImportCancelledError);
    expect(confirm.mock.calls[0]![0].questions.map((q) => q.questionIndex)).toEqual([1]);
  });
  it("rejects duplicate media entry names before asking for consent", async () => {
    const source = `<package><rounds><round>${theme("T", '<question><scenario><atom type="image">@Html/x.png</atom></scenario></question><question type="html"/>' + normal(100, "keep"))}</round></rounds></package>`;
    const archive = zipSync({
      "content.xml": bytes(source),
      "Images/Html/x.png": bytes("media"),
      "Images/Html/y.png": new Uint8Array(),
      "Html/x.png": bytes("html"),
    });
    // Rename the second file in its local and central ZIP headers (same length).
    const from = bytes("Images/Html/y.png");
    const to = bytes("Images/Html/x.png");
    let replacements = 0;
    for (let i = 0; i <= archive.length - from.length; i++) {
      if (from.every((value, j) => archive[i + j] === value)) {
        archive.set(to, i);
        replacements++;
      }
    }
    expect(replacements).toBe(2);
    const seen: string[] = [];
    await readZip(archive, (name) => {
      seen.push(name);
      return name === "content.xml";
    });
    expect(seen.filter((name) => name === "Images/Html/x.png")).toHaveLength(2);
    const input = {
      name: "duplicate.siq",
      arrayBuffer: async () =>
        archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
    } as File;
    const confirm = vi.fn(async (_report: HtmlRemovalReport) => true);
    await expect(readPackageFile(input, { confirmHtmlRemoval: confirm })).rejects.toThrow("notZip");
    expect(confirm).not.toHaveBeenCalled();
  });
});
