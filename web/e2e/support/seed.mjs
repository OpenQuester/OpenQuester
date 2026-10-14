// Creates a demo package through the public API: every question type, one
// image question and a final round. Used by Playwright and runnable by hand:
//   node e2e/support/seed.mjs http://localhost:53000
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const ANSWER_DELAY = 1000;
const SHOW_ANSWER = 2500;

/** A tiny valid PNG (solid colour) so media questions work without fixtures. */
export function makePng(width = 160, height = 90, rgb = [255, 181, 71]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => rgb).flat()),
  ]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const q = (order, price, text, answerText, extra = {}) => ({
  type: "simple",
  subType: "simple",
  order,
  price,
  text,
  answerText,
  answerDelay: ANSWER_DELAY,
  showAnswerDuration: SHOW_ANSWER,
  isHidden: false,
  ...extra,
});

export function demoPackage(title, imageMd5) {
  return {
    title,
    description: "Every question type in one short package. Made for trying OpenQuester.",
    language: "en",
    ageRestriction: "NONE",
    tags: [],
    rounds: [
      {
        name: "Warm-up",
        description: "Simple questions",
        order: 0,
        type: "simple",
        themes: [
          {
            name: "Capitals",
            order: 0,
            questions: [
              q(0, 100, "What is the capital of France?", "Paris", {
                questionComment: "Also the city of light.",
              }),
              q(1, 200, "Which colour is this picture?", "Amber", {
                text: "Which colour is this picture?",
                questionFiles: [
                  { file: { md5: imageMd5, type: "image" }, displayTime: null, order: 0 },
                ],
              }),
              q(2, 300, "This capital sits on two continents.", "Istanbul", {
                type: "noRisk",
                priceMultiplier: 2,
              }),
            ],
          },
          {
            name: "Specials",
            order: 1,
            questions: [
              q(0, 200, "Name the largest planet.", "Jupiter", { type: "stake", maxPrice: 1000 }),
              q(1, 300, "How many legs does a spider have?", "Eight", {
                type: "secret",
                subType: "customPrice",
                transferType: "any",
                allowedPrices: [100, 200, 300],
              }),
              q(2, 400, "Which of these is a mammal?", "Dolphin", {
                type: "choice",
                showDelay: 0,
                answers: [
                  { order: 0, text: "Shark", file: null },
                  { order: 1, text: "Dolphin", file: null },
                  { order: 2, text: "Octopus", file: null },
                  { order: 3, text: "Trout", file: null },
                ],
              }),
            ],
          },
        ],
      },
      {
        name: "Final",
        description: "Final round",
        order: 1,
        type: "final",
        themes: ["Science", "Music", "Sport"].map((name, i) => ({
          name,
          order: i,
          questions: [
            q(
              0,
              null,
              `Final ${name.toLowerCase()} question: name a famous ${name.toLowerCase()} legend.`,
              `${name} legend`,
            ),
          ],
        })),
      },
    ],
  };
}

/** Guests can't upload packages; the dev-only login (ENV=dev) gives a full account. */
async function author(base) {
  const res = await fetch(`${base}/v1/dev/login/1`, { method: "POST" });
  if (!res.ok) throw new Error(`dev login failed: ${res.status} ${await res.text()}`);
  return res.headers.get("set-cookie").split(";")[0];
}

export async function seedPackage(base, title = "Demo: every question type") {
  const png = makePng();
  const md5 = createHash("md5").update(png).digest("hex");
  const cookie = await author(base);
  const res = await fetch(`${base}/v1/packages`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ content: demoPackage(title, md5) }),
  });
  if (!res.ok) throw new Error(`package upload failed: ${res.status} ${await res.text()}`);
  const { id, uploadLinks } = await res.json();
  for (const [name, url] of Object.entries(uploadLinks)) {
    if (name !== md5) continue;
    const put = await fetch(url, {
      method: "PUT",
      headers: {
        "content-md5": createHash("md5").update(png).digest("base64"),
        "content-type": "image/png",
      },
      body: png,
    });
    if (!put.ok) throw new Error(`media upload failed: ${put.status} ${await put.text()}`);
  }
  return { id, title };
}

/** A wide board: 6 themes with 10 questions each, like many SIGame packages. */
export async function seedBigPackage(base, title = "Big board") {
  const cookie = await author(base);
  const themes = Array.from({ length: 6 }, (_, t) => ({
    name: [
      "Manga and novels",
      "Describe the poster",
      "Guess the special",
      "Fell asleep on the keyboard",
      "Hatter",
      "Villains",
    ][t],
    order: t,
    questions: Array.from({ length: 10 }, (_, i) =>
      q(i, 2 + i * 0, `Question ${t + 1}.${i + 1}`, `Answer ${t + 1}.${i + 1}`),
    ),
  }));
  themes[4].questions[9].price = 10;
  // A file that is never uploaded: the app must show a clear "couldn't load" state.
  themes[0].questions[0].questionFiles = [
    {
      file: { md5: "0123456789abcdef0123456789abcdef", type: "image" },
      displayTime: null,
      order: 0,
    },
  ];
  const res = await fetch(`${base}/v1/packages`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      content: {
        title,
        language: "en",
        ageRestriction: "NONE",
        tags: [],
        rounds: [{ name: "Wide", order: 0, type: "simple", themes }],
      },
    }),
  });
  if (!res.ok) throw new Error(`big package upload failed: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  return { id, title };
}

/** "Everyone answers" questions: no-risk and stake with subType forEveryone. */
export async function seedAllPlayPackage(base, title = "Everyone answers") {
  const cookie = await author(base);
  const res = await fetch(`${base}/v1/packages`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      content: {
        title,
        language: "en",
        ageRestriction: "NONE",
        tags: [],
        rounds: [
          {
            name: "Together",
            order: 0,
            type: "simple",
            themes: [
              {
                name: "Everyone",
                order: 0,
                questions: [
                  q(0, 100, "Which planet is known as the red planet?", "Mars", {
                    type: "noRisk",
                    subType: "forEveryone",
                    priceMultiplier: 2,
                    rightAnswers: ["The red planet Mars"],
                    wrongAnswers: ["Venus"],
                    sources: ["NASA"],
                  }),
                  q(1, 200, "What is the chemical symbol for gold?", "Au", {
                    type: "stake",
                    subType: "forEveryone",
                    maxPrice: 300,
                  }),
                ],
              },
            ],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`all-play package upload failed: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  return { id, title };
}

/** Uploads each file the server asks for; `files` maps md5 to body and type. */
async function uploadFiles(uploadLinks, files) {
  for (const [name, url] of Object.entries(uploadLinks)) {
    const file = files[name];
    if (!file) continue;
    const put = await fetch(url, {
      method: "PUT",
      headers: {
        "content-md5": createHash("md5").update(file.body).digest("base64"),
        "content-type": file.type,
      },
      body: file.body,
    });
    if (!put.ok) throw new Error(`media upload failed: ${put.status} ${await put.text()}`);
  }
}

/** Video, image and audio questions plus a text → video → image sequence. */
export async function seedMediaPackage(base, title = "Media check") {
  const cookie = await author(base);
  const clip = readFileSync(new URL("../fixtures/clip.webm", import.meta.url));
  const png = makePng(1600, 900, [90, 140, 255]);
  const md5 = (b) => createHash("md5").update(b).digest("hex");
  const files = {
    [md5(clip)]: { body: clip, type: "video/webm" },
    [md5(png)]: { body: png, type: "image/png" },
  };
  const media = (hash, type) => [{ file: { md5: hash, type }, displayTime: null, order: 0 }];
  const res = await fetch(`${base}/v1/packages`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      content: {
        title,
        language: "en",
        ageRestriction: "NONE",
        tags: [],
        rounds: [
          {
            name: "Media",
            order: 0,
            type: "simple",
            themes: [
              {
                name: "Media",
                order: 0,
                questions: [
                  q(0, 100, "What is on the screen?", "Test pattern", {
                    questionFiles: media(md5(clip), "video"),
                  }),
                  q(1, 200, "Which colour is this picture?", "Blue", {
                    questionFiles: media(md5(png), "image"),
                  }),
                  q(2, 300, "Which note is this?", "A", {
                    questionFiles: media(md5(clip), "audio"),
                  }),
                  // SIGame-style sequence: the text alone, then the clip, then the picture.
                  q(3, 400, "Watch closely, then name the colour", "Blue", {
                    textOrder: 0,
                    questionFiles: [
                      { file: { md5: md5(clip), type: "video" }, displayTime: null, order: 1 },
                      { file: { md5: md5(png), type: "image" }, displayTime: 3000, order: 2 },
                    ],
                  }),
                ],
              },
            ],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`media package upload failed: ${res.status} ${await res.text()}`);
  const { id, uploadLinks } = await res.json();
  await uploadFiles(uploadLinks, files);
  return { id, title };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2] ?? "http://localhost:53000";
  seedPackage(base, process.argv[3])
    .then((p) => console.log(`Seeded package ${p.id}: ${p.title}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
