import { strToU8 as rawStrToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { md5Hex, readZip } from "./archive";
import { parseOq } from "./oq";
import { parseSiq } from "./siq";

// jsdom's TextEncoder returns a Uint8Array from another realm, which fflate
// would mistake for a folder; copy it into this realm's Uint8Array.
const strToU8 = (s: string) => new Uint8Array(rawStrToU8(s));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const mp3 = new Uint8Array([0x49, 0x44, 0x33, 9, 9, 9]);

async function siq(xml: string, media: Record<string, Uint8Array> = {}) {
  const zip = zipSync({ "content.xml": strToU8(xml), ...media });
  return parseSiq(await readZip(zip));
}

const V5 = `<?xml version="1.0" encoding="utf-8"?>
<package name="Pub quiz" version="5" language="en" restriction="16+" logo="@logo.png"
  xmlns="https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd">
  <tags><tag>general</tag></tags>
  <info><comments>Friday night set</comments></info>
  <rounds>
    <round name="Round 1">
      <themes>
        <theme name="Capitals">
          <questions>
            <question price="100">
              <params>
                <param name="question" type="content">
                  <item>What is the capital of France?</item>
                  <item type="image" isRef="True">eiffel tower.png</item>
                </param>
                <param name="answer" type="content">
                  <item type="audio" isRef="True">anthem.mp3</item>
                </param>
              </params>
              <right><answer>Paris</answer></right>
              <wrong><answer>Lyon</answer></wrong>
            </question>
            <question price="200" type="secret">
              <params>
                <param name="question" type="content"><item>Cat in a bag</item></param>
                <param name="selectionMode">exceptCurrent</param>
              </params>
              <right><answer>Cat</answer></right>
            </question>
            <question price="300" type="stake">
              <params><param name="question" type="content"><item>Bid on it</item></param></params>
              <right><answer>Yes</answer></right>
            </question>
            <question price="400">
              <params><param name="question" type="content"><item type="image" isRef="True">gone.png</item></param></params>
              <right><answer>Nothing</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
    <round name="Final" type="final">
      <themes>
        <theme name="Science">
          <questions>
            <question price="0">
              <params><param name="question" type="content"><item>Name the closest star.</item></param></params>
              <right><answer>The Sun</answer></right>
            </question>
          </questions>
        </theme>
      </themes>
    </round>
  </rounds>
</package>`;

describe("parseSiq", () => {
  it("reads a format 5 package with media, specials and a final round", async () => {
    const parsed = await siq(V5, {
      // SIGame stores names URL-encoded.
      "Images/eiffel%20tower.png": png,
      "Images/logo.png": png,
      "Audio/anthem.mp3": mp3,
    });
    const c = parsed.content;
    expect(c).toMatchObject({
      title: "Pub quiz",
      language: "en",
      ageRestriction: "A16",
      description: "Friday night set",
      tags: [{ tag: "general" }],
      logo: { file: { md5: md5Hex(png), type: "image" } },
    });
    const [simple, secret, stake] = c.rounds[0]!.themes[0]!.questions;
    expect(simple).toMatchObject({
      type: "simple",
      price: 100,
      text: "What is the capital of France?",
      // SIGame shows the text first, then the picture.
      textOrder: 0,
      answerText: "Paris",
      answerHint: "Wrong answers: Lyon",
      questionFiles: [{ file: { md5: md5Hex(png), type: "image" }, order: 1, displayTime: null }],
      // SIGame plays audio in the background by default.
      answerFiles: [
        { file: { md5: md5Hex(mp3), type: "audio" }, order: 0, placement: "background" },
      ],
    });
    // A text-only question keeps its text as a plain caption.
    expect(secret!.textOrder).toBeNull();
    expect(secret).toMatchObject({
      type: "secret",
      subType: "simple",
      transferType: "exceptCurrent",
    });
    expect(stake).toMatchObject({ type: "stake", subType: "simple", maxPrice: null });
    // The question whose only content is missing is skipped, with a reason.
    expect(c.rounds[0]!.themes[0]!.questions).toHaveLength(3);
    expect(parsed.warnings.map((w) => w.code)).toEqual(["missingFile", "emptyQuestion"]);

    expect(c.rounds[1]).toMatchObject({ type: "final", order: 1 });
    expect(c.rounds[1]!.themes[0]!.questions[0]).toMatchObject({ type: "simple", price: null });

    // The logo and question image are the same bytes: uploaded once.
    expect([...parsed.files.keys()].sort()).toEqual([md5Hex(png), md5Hex(mp3)].sort());
  });

  it("reads a format 4 package, splitting media at the answer marker", async () => {
    const parsed = await siq(
      `<package name="Old pack"><rounds><round name="R"><themes><theme name="T"><questions>
        <question price="50">
          <type name="auction"/>
          <scenario>
            <atom>Listen</atom>
            <atom type="voice">@song.mp3</atom>
            <atom type="marker"/>
            <atom type="image">@cover.png</atom>
          </scenario>
          <right><answer>Song</answer></right>
        </question>
      </questions></theme></themes></round></rounds></package>`,
      { "Audio/song.mp3": mp3, "Images/cover.png": png },
    );
    const q = parsed.content.rounds[0]!.themes[0]!.questions[0]!;
    expect(q).toMatchObject({
      type: "stake",
      text: "Listen",
      textOrder: 0,
      questionFiles: [{ file: { type: "audio" }, order: 1, placement: "background" }],
      answerFiles: [{ file: { type: "image" } }],
      showAnswerDuration: 10_000,
    });
    expect(parsed.warnings).toEqual([]);
  });

  it("keeps the order, grouping and timing of format 5 content", async () => {
    const vid = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const vid2 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x71]);
    const parsed = await siq(
      `<package name="Films" version="5"><rounds><round name="R"><themes><theme name="T"><questions>
        <question price="100">
          <params><param name="question" type="content">
            <item>Name the film</item>
            <item type="video" isRef="True">a.mp4</item>
            <item type="video" isRef="True" duration="00:00:08">b.mp4</item>
          </param></params>
          <right><answer>Heat</answer></right>
        </question>
        <question price="200">
          <params><param name="question" type="content">
            <item waitForFinish="False">Who is this?</item>
            <item type="image" isRef="True">a.png</item>
            <item type="audio" isRef="True" placement="screen" waitForFinish="False">a.mp3</item>
            <item type="image" isRef="True">a.png</item>
          </param></params>
          <right><answer>Me</answer></right>
        </question>
      </questions></theme></themes></round></rounds></package>`,
      { "Video/a.mp4": vid, "Video/b.mp4": vid2, "Images/a.png": png, "Audio/a.mp3": mp3 },
    );
    const [films, who] = parsed.content.rounds[0]!.themes[0]!.questions;
    // text → video → video, one at a time.
    expect(films).toMatchObject({
      textOrder: 0,
      questionFiles: [
        { file: { type: "video" }, order: 1, displayTime: null },
        { file: { type: "video" }, order: 2, displayTime: 8_000 },
      ],
    });
    expect(films!.questionFiles![0]).not.toHaveProperty("waitForFinish");
    // A text shown together with the next item stays a caption; grouping is kept.
    expect(who!.textOrder).toBeNull();
    expect(who!.questionFiles).toMatchObject([
      { order: 1 },
      { order: 2, waitForFinish: false },
      { order: 3 },
    ]);
    expect(who!.questionFiles![1]).not.toHaveProperty("placement");
  });

  it("explains a file that isn't a package", async () => {
    await expect(parseSiq(await readZip(zipSync({ "readme.txt": strToU8("hi") })))).rejects.toThrow(
      "noContentXml",
    );
    await expect(readZip(strToU8("not a zip"))).rejects.toThrow("notZip");
  });
});

describe("parseOq", () => {
  it("strips server fields, keeps media by hash and downgrades a one-option choice", async () => {
    const md5 = md5Hex(png);
    const content = {
      id: 7,
      title: "Exported",
      author: { id: 1, username: "me" },
      createdAt: "2026-01-01T00:00:00Z",
      ageRestriction: "NONE",
      tags: [{ id: 3, tag: "fun" }],
      rounds: [
        {
          id: 1,
          name: "R1",
          order: 0,
          type: "simple",
          themes: [
            {
              id: 2,
              name: "T1",
              order: 0,
              questions: [
                {
                  id: 9,
                  type: "simple",
                  order: 0,
                  price: 100,
                  text: "Q",
                  answerText: "A",
                  showAnswerDuration: 5000,
                  questionFiles: [
                    { id: 4, order: 0, displayTime: null, file: { id: 5, md5, type: "image" } },
                  ],
                },
                {
                  type: "choice",
                  order: 1,
                  price: 200,
                  text: "Pick",
                  showAnswerDuration: 5000,
                  showDelay: 0,
                  answers: [{ order: 0, text: "Only" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const zip = zipSync({
      "content.json": strToU8(JSON.stringify(content)),
      [`files/${md5}`]: png,
    });
    const parsed = await parseOq(await readZip(zip));
    const [q1, q2] = parsed.content.rounds[0]!.themes[0]!.questions;
    expect(parsed.content).not.toHaveProperty("id");
    expect(parsed.content.tags).toEqual([{ tag: "fun" }]);
    expect(q1).not.toHaveProperty("id");
    expect(q1!.questionFiles).toEqual([
      { order: 0, displayTime: null, file: { md5, type: "image" } },
    ]);
    expect(q2).toMatchObject({ type: "simple" });
    expect(q2).not.toHaveProperty("answers");
    expect(parsed.files.get(md5)?.type).toBe("image");
    expect(parsed.warnings.map((w) => w.code)).toEqual(["choiceAsSimple"]);
  });
});
