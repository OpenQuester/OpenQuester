import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { md5 } from "hash-wasm";

type ExportRequest = { type: "export"; document: unknown };
type ImportRequest = { type: "import"; buffer: ArrayBuffer; filename: string };
type HashRequest = { type: "hash"; buffer: ArrayBuffer; id: string };
type ArchiveMedia = {
  hash?: string;
  file?: Blob;
  data?: ArrayBuffer;
  url?: string;
};

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const textOf = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textOf(record["#text"] ?? record.atom ?? record.item ?? "");
  }
  return "";
};

const ownedBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

export function validateArchive(files: Record<string, Uint8Array>) {
  const paths = Object.keys(files);
  const unsafe = paths.find(
    (path) =>
      path.startsWith("/") ||
      path.includes("\\") ||
      path.split("/").some((part) => part === ".." || part === ""),
  );
  if (unsafe) throw new Error("Archive contains an unsafe path");
  if (paths.length > 2_000) throw new Error("Archive contains too many files");
  const totalSize = Object.values(files).reduce(
    (total, file) => total + file.byteLength,
    0,
  );
  if (totalSize > 512 * 1024 * 1024)
    throw new Error("Archive expands beyond the 512 MB safety limit");
}

export async function exportOq(document: unknown) {
  const clean = structuredClone(document) as Record<string, unknown>;
  const archive: Record<string, Uint8Array> = {};
  const rounds = asArray(
    (clean.rounds as Array<Record<string, unknown>> | undefined) ?? [],
  );
  for (const round of rounds) {
    for (const theme of asArray(
      (round.themes as Array<Record<string, unknown>> | undefined) ?? [],
    )) {
      for (const question of asArray(
        (theme.questions as Array<Record<string, unknown>> | undefined) ?? [],
      )) {
        for (const media of asArray(
          (question.media as ArchiveMedia[] | undefined) ?? [],
        )) {
          let bytes: Uint8Array | undefined;
          if (media.file instanceof Blob)
            bytes = new Uint8Array(await media.file.arrayBuffer());
          else if (media.data instanceof ArrayBuffer)
            bytes = new Uint8Array(media.data);
          if (media.hash) {
            if (!bytes)
              throw new Error(`Media content is missing for ${media.hash}`);
            const actualHash = await md5(bytes);
            if (actualHash.toLowerCase() !== media.hash.toLowerCase())
              throw new Error(
                `Media hash does not match its content: ${media.hash}`,
              );
            archive[`media/${media.hash}`] = bytes;
          }
          delete media.file;
          delete media.data;
          delete media.url;
        }
      }
    }
  }
  archive["content.json"] = strToU8(JSON.stringify(clean, null, 2));
  return zipSync(archive, { level: 6 });
}

export function restoreOqMedia(
  document: unknown,
  files: Record<string, Uint8Array>,
) {
  const clean = document as Record<string, unknown>;
  const rounds = asArray(
    (clean.rounds as Array<Record<string, unknown>> | undefined) ?? [],
  );
  for (const round of rounds)
    for (const theme of asArray(
      (round.themes as Array<Record<string, unknown>> | undefined) ?? [],
    ))
      for (const question of asArray(
        (theme.questions as Array<Record<string, unknown>> | undefined) ?? [],
      ))
        for (const media of asArray(
          (question.media as ArchiveMedia[] | undefined) ?? [],
        )) {
          if (!media.hash) continue;
          const entry = files[`media/${media.hash}`] ?? files[media.hash];
          if (entry) media.data = ownedBuffer(entry);
        }
  return clean;
}

export async function validateOqMediaHashes(
  document: unknown,
  files: Record<string, Uint8Array>,
) {
  const clean = document as Record<string, unknown>;
  const rounds = asArray(
    (clean.rounds as Array<Record<string, unknown>> | undefined) ?? [],
  );
  for (const round of rounds)
    for (const theme of asArray(
      (round.themes as Array<Record<string, unknown>> | undefined) ?? [],
    ))
      for (const question of asArray(
        (theme.questions as Array<Record<string, unknown>> | undefined) ?? [],
      ))
        for (const media of asArray(
          (question.media as ArchiveMedia[] | undefined) ?? [],
        )) {
          if (!media.hash) continue;
          if (!/^[a-f\d]{32}$/i.test(media.hash))
            throw new Error(`Invalid media hash: ${media.hash}`);
          const entry = files[`media/${media.hash}`] ?? files[media.hash];
          if (!entry)
            throw new Error(`Archive media is missing: ${media.hash}`);
          const actualHash = await md5(entry);
          if (actualHash.toLowerCase() !== media.hash.toLowerCase())
            throw new Error(`Archive media hash mismatch: ${media.hash}`);
        }
}

async function convertSiq(files: Record<string, Uint8Array>) {
  const content = files["content.xml"];
  if (!content) throw new Error("SIQ archive does not contain content.xml");
  const xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  }).parse(strFromU8(content)) as Record<string, unknown>;
  const pack = (xml.package ?? xml.Package) as
    Record<string, unknown> | undefined;
  if (!pack) throw new Error("Malformed SIQ package XML");
  const roundContainer = (pack.rounds ?? pack.Rounds) as
    Record<string, unknown> | undefined;
  const sourceRounds = asArray(
    (roundContainer?.round ?? roundContainer?.Round) as
      Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const warnings: string[] = [];
  const rounds = await Promise.all(
    sourceRounds.map(async (sourceRound, roundOrder) => {
      const themeContainer = (sourceRound.themes ?? sourceRound.Themes) as
        Record<string, unknown> | undefined;
      const sourceThemes = asArray(
        (themeContainer?.theme ?? themeContainer?.Theme) as
          Record<string, unknown> | Record<string, unknown>[] | undefined,
      );
      const themes = await Promise.all(
        sourceThemes.map(async (sourceTheme, themeOrder) => {
          const questionContainer = (sourceTheme.questions ??
            sourceTheme.Questions) as Record<string, unknown> | undefined;
          const sourceQuestions = asArray(
            (questionContainer?.question ?? questionContainer?.Question) as
              Record<string, unknown> | Record<string, unknown>[] | undefined,
          );
          const questions = await Promise.all(
            sourceQuestions.map(async (sourceQuestion, questionOrder) => {
              const rawType = textOf(
                sourceQuestion["@_type"] ??
                  (
                    sourceQuestion.type as Record<string, unknown> | undefined
                  )?.["@_name"] ??
                  "simple",
              );
              const typeMap: Record<string, string> = {
                auction: "stake",
                bagcat: "secret",
                cat: "secret",
                sponsored: "no-risk",
                stake: "stake",
                secret: "secret",
                noRisk: "no-risk",
                choice: "choice",
                hidden: "hidden",
              };
              const type = (typeMap[rawType] ?? "simple") as
                "simple" | "stake" | "secret" | "no-risk" | "choice" | "hidden";
              if (!typeMap[rawType] && rawType !== "simple")
                warnings.push(
                  `Question type '${rawType}' was converted to simple.`,
                );
              const params = (sourceQuestion.params ??
                sourceQuestion.scenario) as Record<string, unknown> | undefined;
              const paramsList = asArray(
                (params?.param ?? params?.atom ?? params?.item) as
                  | Record<string, unknown>
                  | Record<string, unknown>[]
                  | undefined,
              );
              const questionParam =
                paramsList.find((item) => item["@_name"] === "question") ??
                params;
              const answerParam = paramsList.find(
                (item) => item["@_name"] === "answer",
              );
              const right = sourceQuestion.right as
                Record<string, unknown> | undefined;
              const answer =
                asArray(right?.answer ?? right?.Answer)
                  .map(textOf)
                  .filter(Boolean)
                  .join(" / ") || textOf(answerParam);
              const media: Array<{
                id: string;
                hash: string;
                type: "image" | "audio" | "video";
                name: string;
                size: number;
                data: ArrayBuffer;
              }> = [];
              for (const item of paramsList) {
                const mediaType = textOf(item["@_type"] ?? "").toLowerCase();
                if (!["image", "audio", "video"].includes(mediaType)) continue;
                const rawName = textOf(item).replace(/^@/, "");
                const folder =
                  mediaType === "image"
                    ? "Images"
                    : mediaType === "audio"
                      ? "Audio"
                      : "Video";
                const entry = files[`${folder}/${rawName}`] ?? files[rawName];
                if (!entry) {
                  warnings.push(`Missing media file: ${rawName}`);
                  continue;
                }
                media.push({
                  id: crypto.randomUUID(),
                  hash: await md5(entry),
                  type: mediaType as "image" | "audio" | "video",
                  name: rawName,
                  size: entry.byteLength,
                  data: ownedBuffer(entry),
                });
              }
              return {
                id: crypto.randomUUID(),
                order: questionOrder,
                price: Number(
                  sourceQuestion["@_price"] ?? (questionOrder + 1) * 100,
                ),
                type,
                text: textOf(questionParam),
                answer,
                choices: [],
                media,
              };
            }),
          );
          return {
            id: crypto.randomUUID(),
            order: themeOrder,
            name: textOf(sourceTheme["@_name"] ?? `Theme ${themeOrder + 1}`),
            description: "",
            questions,
          };
        }),
      );
      return {
        id: crypto.randomUUID(),
        order: roundOrder,
        name: textOf(sourceRound["@_name"] ?? `Round ${roundOrder + 1}`),
        description: "",
        type: sourceRound["@_type"] === "final" ? "final" : "standard",
        themes,
      };
    }),
  );
  return {
    document: {
      title: textOf(pack["@_name"] ?? "Imported SIQ package"),
      description: "",
      language: "en",
      ageRestriction: "NONE",
      status: "draft",
      rounds,
    },
    warnings,
  };
}

export const handleWorkerMessage = async (
  event: MessageEvent<ExportRequest | ImportRequest | HashRequest>,
) => {
  try {
    if (event.data.type === "hash") {
      self.postMessage({
        type: "hashed",
        id: event.data.id,
        hash: await md5(new Uint8Array(event.data.buffer)),
      });
      return;
    }
    if (event.data.type === "export") {
      self.postMessage({ type: "progress", progress: 15 });
      const zipped = await exportOq(event.data.document);
      self.postMessage({ type: "progress", progress: 100 });
      self.postMessage({ type: "exported", buffer: zipped.buffer }, [
        zipped.buffer,
      ]);
      return;
    }
    const bytes = new Uint8Array(event.data.buffer);
    const files = unzipSync(bytes);
    validateArchive(files);
    if (event.data.filename.toLowerCase().endsWith(".siq")) {
      const result = await convertSiq(files);
      self.postMessage({ type: "imported", ...result });
      return;
    }
    const content = files["content.json"];
    if (!content) throw new Error("Archive does not contain content.json");
    const parsed: unknown = JSON.parse(strFromU8(content));
    await validateOqMediaHashes(parsed, files);
    const document: unknown = restoreOqMedia(parsed, files);
    self.postMessage({ type: "imported", document });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Archive operation failed",
    });
  }
};

if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  self.onmessage = handleWorkerMessage;
}
