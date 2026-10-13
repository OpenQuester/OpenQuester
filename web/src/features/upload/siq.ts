import type { Unzipped } from "fflate";

import { EntryIndex, md5Hex, yieldToBrowser } from "./archive";
import type {
  FileRef,
  ImportWarning,
  MediaFile,
  MediaType,
  ParsedPackage,
  QuestionFile,
  UploadContent,
  UploadQuestion,
  UploadRound,
  UploadTheme,
} from "./types";

/**
 * Reads a SIGame .siq archive (content.xml formats 4 and 5) into an OpenQuester
 * package. Mirrors client/packages/siq_file (the Flutter reader) and keeps its
 * defaults, but reports problems as warnings instead of failing the whole file.
 */
export async function parseSiq(entries: Unzipped): Promise<ParsedPackage> {
  const index = new EntryIndex(entries);
  const xml = index.find("content.xml");
  if (!xml) throw new Error("noContentXml");
  const doc = new DOMParser().parseFromString(
    new TextDecoder().decode(xml.bytes),
    "application/xml",
  );
  const pkg = doc.documentElement;
  if (!pkg || pkg.localName !== "package" || doc.getElementsByTagName("parsererror").length)
    throw new Error("badContentXml");

  const reader = new SiqReader(index);
  await yieldToBrowser();
  const content = reader.readPackage(pkg);
  return { format: "siq", content, files: reader.files, warnings: reader.warnings };
}

const FOLDERS: Record<MediaType, string> = { image: "Images", audio: "Audio", video: "Video" };

/** SIGame names for the special question kinds OpenQuester supports. */
const TYPE_ALIASES: Record<string, UploadQuestion["type"]> = {
  simple: "simple",
  stake: "stake",
  auction: "stake",
  secret: "secret",
  secretPublicPrice: "secret",
  secretNoQuestion: "secret",
  cat: "secret",
  bagcat: "secret",
  noRisk: "noRisk",
  sponsored: "noRisk",
};

const QUESTION_DISPLAY = 20_000;
const ANSWER_DISPLAY = 15_000;

class SiqReader {
  files = new Map<string, MediaFile>();
  warnings: ImportWarning[] = [];
  private byPath = new Map<string, string>();

  constructor(private readonly index: EntryIndex) {}

  readPackage(pkg: Element): UploadContent {
    const restriction = pkg.getAttribute("restriction")?.trim();
    const logoRef = pkg.getAttribute("logo");
    const logo = logoRef ? this.media("image", logoRef, "") : null;
    const tags = [...children(child(pkg, "tags"), "tag")]
      .map((t) => text(t))
      .filter(Boolean)
      .map((tag) => ({ tag }));
    const rounds = [...children(child(pkg, "rounds"), "round")].map((r, i) => this.round(r, i));
    // OpenQuester allows one final round and it must come last.
    const finals = rounds.filter((r) => r.type === "final");
    for (const extra of finals.slice(0, -1)) extra.type = "simple";
    const last = finals.at(-1);
    if (last && rounds.at(-1) !== last) last.type = "simple";
    return {
      title: pkg.getAttribute("name")?.trim() || "Untitled package",
      description: nonEmpty(pkg.getAttribute("description")) ?? comment(pkg),
      language: nonEmpty(pkg.getAttribute("language")),
      ageRestriction:
        restriction === "12+"
          ? "A12"
          : restriction === "16+"
            ? "A16"
            : restriction === "18+"
              ? "A18"
              : "NONE",
      logo: logo ? { file: logo } : null,
      tags,
      rounds: rounds.map((r, order) => ({ ...r, order })),
    };
  }

  private round(round: Element, order: number): UploadRound {
    const name = round.getAttribute("name")?.trim() || "-";
    const type = round.getAttribute("type") === "final" ? "final" : "simple";
    const themes = [...children(child(round, "themes"), "theme")]
      .map((t, i) => this.theme(t, i, name, type))
      .filter((t): t is UploadTheme => t != null);
    return {
      name,
      order,
      description: nonEmpty(round.getAttribute("description")) ?? comment(round),
      type,
      themes: themes.map((t, i) => ({ ...t, order: i })),
    };
  }

  private theme(
    theme: Element,
    order: number,
    roundName: string,
    roundType: "simple" | "final",
  ): UploadTheme | null {
    const name = theme.getAttribute("name")?.trim() || "-";
    let questions = [...children(child(theme, "questions"), "question")]
      .map((q, i) => this.question(q, i, `${roundName} › ${name}`, roundType))
      .filter((q): q is UploadQuestion => q != null);
    if (roundType === "final") {
      // A final theme holds exactly one question; a theme without one can't be played.
      if (questions.length === 0) return null;
      questions = questions.slice(0, 1);
    }
    return {
      name,
      order,
      description: comment(theme),
      questions: questions.map((q, i) => ({ ...q, order: i })),
    };
  }

  private question(
    q: Element,
    order: number,
    path: string,
    roundType: "simple" | "final",
  ): UploadQuestion | null {
    const priceRaw = Number.parseInt(q.getAttribute("price") ?? "", 10);
    const price = Number.isFinite(priceRaw) ? Math.max(0, priceRaw) : 0;
    const where = roundType === "final" ? path : `${path} › ${price}`;

    const params = child(q, "params");
    const body = params ? this.readV5(params, where) : this.readV4(child(q, "scenario"), where);

    const right = answersOf(q, "right");
    const wrong = answersOf(q, "wrong");
    const answerText = right.length ? right.join(" / ") : null;
    if (!body.text && body.questionFiles.length === 0) {
      this.warnings.push({ code: "emptyQuestion", where });
      return null;
    }
    if (!answerText && body.answerFiles.length === 0)
      this.warnings.push({ code: "noAnswer", where });

    const rawType = q.getAttribute("type") ?? child(q, "type")?.getAttribute("name") ?? "simple";
    let type = TYPE_ALIASES[rawType];
    if (!type) {
      this.warnings.push({ code: "unknownType", where, detail: rawType });
      type = "simple";
    }
    if (roundType === "final") type = "simple";

    const firstType = body.questionFiles[0]?.file.type;
    const base: UploadQuestion = {
      type,
      order,
      price: roundType === "final" ? null : price,
      text: body.text,
      questionComment: body.comment,
      answerText,
      answerHint: wrong.length ? `Wrong answers: ${wrong.join(" / ")}` : null,
      showAnswerDuration: firstType === "video" ? 15_000 : firstType === "audio" ? 10_000 : 5_000,
      questionFiles: body.questionFiles,
      answerFiles: body.answerFiles,
    };
    switch (type) {
      case "stake":
        return { ...base, subType: "simple", maxPrice: null };
      case "secret":
        return {
          ...base,
          subType: "simple",
          transferType: body.selectionMode === "exceptCurrent" ? "exceptCurrent" : "any",
        };
      case "noRisk":
        return { ...base, subType: "simple", priceMultiplier: 2 };
      default:
        return base;
    }
  }

  /** Format 5: <params><param name="question" type="content"><item …/></param>…</params> */
  private readV5(params: Element, where: string) {
    const byName = (n: string) =>
      [...children(params, "param")].find((p) => p.getAttribute("name") === n) ?? null;
    const question = byName("question") ?? params;
    const answer = byName("answer");
    const read = (param: Element | null, display: number) => {
      const texts: string[] = [];
      const said: string[] = [];
      const files: FileRef[] = [];
      for (const item of children(param, "item")) {
        const kind = item.getAttribute("type") ?? "text";
        const value = text(item);
        if (!value) continue;
        if (kind === "text" || kind === "say") {
          (item.getAttribute("placement") === "replic" || kind === "say" ? said : texts).push(
            value,
          );
          continue;
        }
        const media = mediaType(kind);
        if (!media) continue;
        if (item.getAttribute("isRef")?.toLowerCase() !== "true" && /^https?:/i.test(value)) {
          this.warnings.push({ code: "externalMedia", where, detail: value });
          continue;
        }
        const ref = this.media(media, value, where);
        if (ref) files.push(ref);
      }
      return { texts, said, files: toQuestionFiles(files, display) };
    };
    const asked = read(question, QUESTION_DISPLAY);
    const shown = read(answer, ANSWER_DISPLAY);
    return {
      text: joined(asked.texts) ?? joined(asked.said),
      comment: asked.texts.length ? joined(asked.said) : null,
      questionFiles: asked.files,
      answerFiles: shown.files,
      selectionMode: byName("selectionMode") ? text(byName("selectionMode")!) : null,
    };
  }

  /** Format 4: <scenario><atom>text</atom><atom type="image">@pic.jpg</atom><atom type="marker"/>…</scenario> */
  private readV4(scenario: Element | null, where: string) {
    const texts: string[] = [];
    const said: string[] = [];
    const qFiles: FileRef[] = [];
    const aFiles: FileRef[] = [];
    let afterMarker = false;
    for (const atom of children(scenario, "atom")) {
      const kind = atom.getAttribute("type") ?? "text";
      if (kind === "marker") {
        afterMarker = true;
        continue;
      }
      const value = text(atom);
      if (!value) continue;
      if (kind === "text") {
        if (!afterMarker) texts.push(value);
        continue;
      }
      if (kind === "say") {
        if (!afterMarker) said.push(value);
        continue;
      }
      const media = mediaType(kind);
      if (!media) continue;
      if (!value.startsWith("@") && /^https?:/i.test(value)) {
        this.warnings.push({ code: "externalMedia", where, detail: value });
        continue;
      }
      const ref = this.media(media, value, where);
      if (ref) (afterMarker ? aFiles : qFiles).push(ref);
    }
    return {
      text: joined(texts) ?? joined(said),
      comment: texts.length ? joined(said) : null,
      questionFiles: toQuestionFiles(qFiles, QUESTION_DISPLAY),
      answerFiles: toQuestionFiles(aFiles, ANSWER_DISPLAY),
      selectionMode: null,
    };
  }

  /** Finds a referenced file in the archive and registers it by MD5. */
  private media(type: MediaType, ref: string, where: string): FileRef | null {
    const file = ref.trim().replace(/^@/, "");
    const path = `${FOLDERS[type]}/${file}`;
    const known = this.byPath.get(path);
    if (known) return { md5: known, type };
    const entry = this.index.find(path);
    if (!entry) {
      this.warnings.push({ code: "missingFile", where, detail: path });
      return null;
    }
    const md5 = md5Hex(entry.bytes);
    this.byPath.set(path, md5);
    if (!this.files.has(md5))
      this.files.set(md5, { md5, type, name: entry.name, bytes: entry.bytes });
    return { md5, type };
  }
}

function* children(el: Element | null | undefined, name: string): Generator<Element> {
  if (!el) return;
  for (const c of Array.from(el.children)) if (c.localName === name) yield c;
}

function child(el: Element | null | undefined, name: string): Element | null {
  for (const c of children(el, name)) return c;
  return null;
}

function text(el: Element): string {
  return (el.textContent ?? "").trim();
}

function nonEmpty(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function joined(parts: string[]): string | null {
  return parts.length ? parts.join(" ") : null;
}

function comment(el: Element): string | null {
  const c = child(child(el, "info"), "comments");
  return c ? nonEmpty(c.textContent) : null;
}

function answersOf(q: Element, kind: "right" | "wrong"): string[] {
  const set = new Set<string>();
  for (const a of children(child(q, kind), "answer")) {
    const v = text(a);
    if (v) set.add(v);
  }
  return [...set];
}

function mediaType(kind: string): MediaType | null {
  if (kind === "image") return "image";
  if (kind === "audio" || kind === "voice") return "audio";
  if (kind === "video") return "video";
  return null;
}

function toQuestionFiles(files: FileRef[], displayTime: number): QuestionFile[] {
  return files.map((file, order) => ({ file, order, displayTime }));
}
