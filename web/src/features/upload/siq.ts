import type { Unzipped } from "fflate";

import { scanSiq, requireRemoval, removalWarnings } from "./htmlRemoval";
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
export async function parseSiq(
  entries: Unzipped,
  allowHtmlRemoval = false,
): Promise<ParsedPackage> {
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

  const originalRounds = [...children(child(pkg, "rounds"), "round")];
  const nonLastFinals = new Set(
    originalRounds.slice(0, -1).filter((r) => r.getAttribute("type") === "final"),
  );
  const names = Object.keys(entries);
  const nonEmptyNames = names.filter((name) => entries[name]!.length > 0);
  const report = scanSiq(pkg, names, false, nonEmptyNames);
  requireRemoval(report, allowHtmlRemoval);
  if (report.questions.length) scanSiq(pkg, names, true, nonEmptyNames);
  const reader = new SiqReader(index, nonLastFinals);
  reader.warnings.push(...removalWarnings(report));
  await yieldToBrowser();
  const content = reader.readPackage(pkg);
  if (
    report.questions.length &&
    !content.rounds.some((r) => r.themes.some((t) => t.questions.length))
  )
    throw new Error("allHtmlQuestions");
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

/**
 * One content item read from SIGame XML, in package order. SIGame plays these
 * one at a time (an item that does not wait for its finish is shown together
 * with the next), so the importer keeps order, placement and timing.
 */
interface ContentEntry {
  kind: "text" | "said" | "file";
  value?: string;
  file?: FileRef;
  placement: "screen" | "background";
  waitForFinish: boolean;
  /** Explicit duration in ms, or null for the default/real length. */
  durationMs: number | null;
}

class SiqReader {
  files = new Map<string, MediaFile>();
  warnings: ImportWarning[] = [];
  private byPath = new Map<string, string>();

  constructor(
    private readonly index: EntryIndex,
    private readonly nonLastFinals: Set<Element>,
  ) {}

  readPackage(pkg: Element): UploadContent {
    const restriction = pkg.getAttribute("restriction")?.trim();
    const logoRef = pkg.getAttribute("logo");
    const logo = logoRef ? this.media("image", logoRef, "") : null;
    const tags = [...children(child(pkg, "tags"), "tag")]
      .map((t) => text(t))
      .filter(Boolean)
      .map((tag) => ({ tag }));
    const nodes = [...children(child(pkg, "rounds"), "round")];
    // Normalize before parsing themes so converted rounds keep all their questions.
    const rounds = nodes.map((r, i) => {
      const final = r.getAttribute("type") === "final";
      const type =
        final && i === nodes.length - 1 && !this.nonLastFinals.has(r) ? "final" : "simple";
      if (final && type === "simple")
        this.warnings.push({ code: "finalAsSimple", where: r.getAttribute("name") ?? "" });
      return this.round(r, i, type);
    });
    return {
      title: pkg.getAttribute("name")?.trim() || "Untitled package",
      description: nonEmpty(pkg.getAttribute("description")) ?? comment(pkg),
      language: nonEmpty(pkg.getAttribute("language")),
      authors: infoList(pkg, "authors", "author"),
      sources: infoList(pkg, "sources", "source"),
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

  private round(round: Element, order: number, type: "simple" | "final"): UploadRound {
    const name = round.getAttribute("name")?.trim() || "-";
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
      if (questions.length > 1)
        this.warnings.push({
          code: "extraFinalQuestions",
          where: `${roundName} › ${name}`,
          detail: String(questions.length - 1),
        });
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
    // The first right answer is the answer; the rest also count as right.
    const answerText = right[0] ?? null;
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
      textOrder: body.textOrder,
      questionComment: body.comment,
      answerText,
      answerHint: null,
      rightAnswers: right.length > 1 ? right.slice(1) : null,
      wrongAnswers: wrong.length ? wrong : null,
      authors: infoList(q, "authors", "author"),
      sources: infoList(q, "sources", "source"),
      showAnswerDuration: firstType === "video" ? 15_000 : firstType === "audio" ? 10_000 : 5_000,
      questionFiles: body.questionFiles,
      answerFiles: body.answerFiles,
    };
    // SIQ v5 number and point answers: the right answer holds the number / "x,y".
    const answerType = "answerType" in body ? body.answerType : null;
    const deviation =
      "answerDeviation" in body && Number.isFinite(body.answerDeviation)
        ? body.answerDeviation
        : null;
    if (answerType === "number" && right[0] != null) {
      const n = Number(right[0].replace(",", ".").replace(/\s/g, ""));
      if (Number.isFinite(n)) {
        base.answerType = "number";
        base.answerNumber = n;
        base.answerDeviation = deviation;
      }
    } else if (answerType === "point" && right[0] != null) {
      const [x, y] = right[0].split(/[,;\s]+/).map(Number);
      if (x! >= 0 && x! <= 1 && y! >= 0 && y! <= 1) {
        base.answerType = "point";
        base.answerPoint = { x: x!, y: y! };
        base.answerDeviation = deviation;
      }
    }
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
    const read = (param: Element | null) => {
      const entries: ContentEntry[] = [];
      for (const item of children(param, "item")) {
        const kind = item.getAttribute("type") ?? "text";
        const value = text(item);
        if (!value) continue;
        const waitForFinish = item.getAttribute("waitForFinish")?.toLowerCase() !== "false";
        const durationMs = parseTimeSpan(item.getAttribute("duration"));
        if (kind === "text" || kind === "say") {
          const said = item.getAttribute("placement") === "replic" || kind === "say";
          entries.push({
            kind: said ? "said" : "text",
            value,
            placement: "screen",
            waitForFinish,
            durationMs,
          });
          continue;
        }
        const media = mediaType(kind);
        if (!media) continue;
        if (item.getAttribute("isRef")?.toLowerCase() !== "true" && /^https?:/i.test(value)) {
          this.warnings.push({ code: "externalMedia", where, detail: value });
          continue;
        }
        const ref = this.media(media, value, where);
        if (!ref) continue;
        // SIGame plays audio in the background unless the item says otherwise.
        const placement =
          media === "audio" && (item.getAttribute("placement") ?? "background") === "background"
            ? "background"
            : "screen";
        entries.push({ kind: "file", file: ref, placement, waitForFinish, durationMs });
      }
      return toSequence(entries);
    };
    const asked = read(question);
    const shown = read(answer);
    return {
      text: joined(asked.texts) ?? joined(asked.said),
      textOrder: asked.texts.length ? asked.textOrder : null,
      comment: asked.texts.length ? joined(asked.said) : null,
      questionFiles: asked.files,
      answerFiles: shown.files,
      selectionMode: byName("selectionMode") ? text(byName("selectionMode")!) : null,
      answerType: byName("answerType") ? text(byName("answerType")!) : null,
      answerDeviation: byName("answerDeviation") ? Number(text(byName("answerDeviation")!)) : null,
    };
  }

  /** Format 4: <scenario><atom>text</atom><atom type="image">@pic.jpg</atom><atom type="marker"/>…</scenario> */
  private readV4(scenario: Element | null, where: string) {
    const asked: ContentEntry[] = [];
    const shown: ContentEntry[] = [];
    let afterMarker = false;
    for (const atom of children(scenario, "atom")) {
      const kind = atom.getAttribute("type") ?? "text";
      if (kind === "marker") {
        afterMarker = true;
        continue;
      }
      const value = text(atom);
      if (!value) continue;
      // SIGame: time -1 means "do not wait"; a positive time is the duration in seconds.
      const time = Number.parseFloat(atom.getAttribute("time") ?? "0");
      const waitForFinish = time !== -1;
      const durationMs = Number.isFinite(time) && time > 0 ? Math.round(time * 1000) : null;
      const into = afterMarker ? shown : asked;
      if (kind === "text" || kind === "say") {
        if (afterMarker) continue;
        into.push({
          kind: kind === "say" ? "said" : "text",
          value,
          placement: "screen",
          waitForFinish,
          durationMs,
        });
        continue;
      }
      const media = mediaType(kind);
      if (!media) continue;
      if (!value.startsWith("@") && /^https?:/i.test(value)) {
        this.warnings.push({ code: "externalMedia", where, detail: value });
        continue;
      }
      const ref = this.media(media, value, where);
      if (!ref) continue;
      into.push({
        kind: "file",
        file: ref,
        placement: kind === "voice" ? "background" : "screen",
        waitForFinish,
        durationMs,
      });
    }
    const q = toSequence(asked);
    const a = toSequence(shown);
    return {
      text: joined(q.texts) ?? joined(q.said),
      textOrder: q.texts.length ? q.textOrder : null,
      comment: q.texts.length ? joined(q.said) : null,
      questionFiles: q.files,
      answerFiles: a.files,
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

/** SIQ <info><authors><author>… (or sources/source) of a package, round, theme or question. */
function infoList(
  el: Element,
  list: "authors" | "sources",
  item: "author" | "source",
): string[] | null {
  const out = [...children(child(child(el, "info"), list), item)]
    .map((a) => text(a))
    .filter((v): v is string => !!v);
  return out.length ? out : null;
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

/**
 * Turns SIGame content items into OpenQuester's model: files keep their
 * order, placement, waitForFinish and duration; all screen texts become the
 * question text, placed where the first one was. A text shown together with
 * the next item (waitForFinish false) or with no media around stays a caption.
 */
function toSequence(entries: ContentEntry[]) {
  const texts: string[] = [];
  const said: string[] = [];
  const files: QuestionFile[] = [];
  let textOrder: number | null = null;
  let textCaption = false;
  let order = 0;
  for (const e of entries) {
    if (e.kind === "said") {
      said.push(e.value!);
      continue;
    }
    if (e.kind === "text") {
      if (texts.length === 0) {
        textOrder = order++;
        textCaption = !e.waitForFinish;
      }
      texts.push(e.value!);
      continue;
    }
    const f: QuestionFile = { file: e.file!, order: order++, displayTime: e.durationMs };
    if (e.placement === "background") f.placement = "background";
    if (!e.waitForFinish) f.waitForFinish = false;
    files.push(f);
  }
  if (textCaption || files.length === 0) textOrder = null;
  return { texts, said, files, textOrder };
}

/** SIGame durations are .NET TimeSpans ("00:00:05" or "00:00:05.5"). */
function parseTimeSpan(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^(?:(\d+)\.)?(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.exec(raw.trim());
  if (!m) return null;
  const [, days, h, min, sec, frac] = m;
  const ms =
    ((Number(days ?? 0) * 24 + Number(h)) * 3600 + Number(min) * 60 + Number(sec)) * 1000 +
    (frac ? Math.round(Number(`0.${frac}`) * 1000) : 0);
  return ms > 0 ? ms : null;
}
