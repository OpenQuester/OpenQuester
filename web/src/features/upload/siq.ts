import { invalidSelectSource, readCompatibilityIssues, sourceFromSiq } from "./siqCompatibility";
import { type SiqQuestionCoordinates, normalizeSiqQuestion } from "./normalizeSiqQuestion";
import { readSiqScript, resolveSiqQuestionParameters } from "./siqScript";
import { VISUAL_QUEUE_THRESHOLD } from "@/game/authoredContentGroups";
import type { Unzipped } from "fflate";

import {
  assertImportContentLimits,
  PackageContentLimitError,
  timelineLimitIssues,
  type ImportLimitIssue,
  type TimelineGroupSize,
  type TimelinePhase,
} from "./contentLimits";
import { parseSiqPoint, pointTargetOrder } from "./siqPoint";
import { scanSiq, requireRemoval, removalWarnings } from "./htmlRemoval";
import { EntryIndex, md5Hex, yieldToBrowser } from "./archive";
import type {
  FileRef,
  ImportWarning,
  MediaFile,
  MediaType,
  ParsedPackage,
  QuestionFile,
  QuestionTextItem,
  UploadContent,
  UploadQuestion,
  UploadRound,
  UploadTheme,
} from "./types";

/**
 * Reads a SIGame .siq archive (content.xml formats 4 and 5) into an OpenQuester
 * package. Recoverable import problems are reported as warnings.
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

  const sequentialWarnings = scanSiqContentLimits(pkg);
  const originalRounds = [...children(child(pkg, "rounds"), "round")];
  const nonLastFinals = new Set(
    originalRounds
      .slice(0, -1)
      .filter((r) => ["final", "themeList"].includes(r.getAttribute("type") ?? "")),
  );
  const names = Object.keys(entries);
  const nonEmptyNames = names.filter((name) => entries[name]!.length > 0);
  const sourceCoordinates = new WeakMap<Element, SiqQuestionCoordinates>();
  originalRounds.forEach((round, ri) => {
    [...children(child(round, "themes"), "theme")].forEach((theme, ti) => {
      [...children(child(theme, "questions"), "question")].forEach((question, qi) => {
        sourceCoordinates.set(question, { round: ri, theme: ti, question: qi });
      });
    });
  });
  const report = scanSiq(pkg, names, false, nonEmptyNames);
  requireRemoval(report, allowHtmlRemoval);
  if (report.questions.length) scanSiq(pkg, names, true, nonEmptyNames);
  const reader = new SiqReader(index, nonLastFinals, sourceCoordinates);
  reader.warnings.push(...removalWarnings(report), ...sequentialWarnings);
  await yieldToBrowser();
  const content = reader.readPackage(pkg);
  assertImportContentLimits(content);
  if (
    report.questions.length &&
    !content.rounds.some((r) => r.themes.some((t) => t.questions.length))
  )
    throw new Error("allHtmlQuestions");
  return { format: "siq", content, files: reader.files, warnings: reader.warnings };
}

const FOLDERS: Record<MediaType, string> = { image: "Images", audio: "Audio", video: "Video" };

/**
 * One content item read from SIGame XML, in package order. SIGame plays these
 * one at a time (an item that does not wait for its finish is shown together
 * with the next), so the importer keeps order, placement and timing.
 */
interface ContentEntry {
  sourceIndex?: number;
  kind: "text" | "said" | "file";
  value?: string;
  file?: FileRef;
  placement: "screen" | "background" | "replic";
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
    private readonly sourceCoordinates: WeakMap<Element, SiqQuestionCoordinates>,
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
      const final = ["final", "themeList"].includes(r.getAttribute("type") ?? "");
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
    if (q.getAttribute("price")?.trim() === "-1") return null;
    const priceRaw = Number.parseInt(q.getAttribute("price") ?? "", 10);
    const price = Number.isFinite(priceRaw) ? Math.max(0, priceRaw) : 0;
    const where = roundType === "final" ? path : `${path} › ${price}`;

    const firstBodyWarning = this.warnings.length;
    const original = q;
    const coordinates = this.sourceCoordinates.get(q);
    const resolvedParameters = resolveSiqQuestionParameters(q, where);
    q = resolvedParameters.question;
    const params = child(q, "params");
    const modernBody = params ? this.readV5(params, where) : null;
    const body = modernBody ?? this.readV4(child(q, "scenario"), where);

    const script = resolvedParameters.issue
      ? null
      : readSiqScript(q, where, roundType === "final", (content) =>
          this.readScriptContent(content, where),
        );
    const handledScript = script != null || resolvedParameters.issue != null;
    const normalized = normalizeSiqQuestion(
      q,
      where,
      roundType === "final",
      (type, name) => this.media(type, name, where),
      coordinates,
      handledScript,
    );
    const award = !handledScript && normalized.fields.secretRules?.outcome === "award";
    const scriptIssue = resolvedParameters.issue ?? script?.issue;
    const importIssues = scriptIssue
      ? [
          ...normalized.issues,
          {
            ...scriptIssue,
            source: scriptIssue.source ?? coordinates,
            sourceData: sourceFromSiq(original, (type, name) => this.media(type, name, where)),
          },
        ]
      : normalized.issues;
    const repairIssues = [
      ...importIssues,
      ...this.warnings.slice(firstBodyWarning).filter((issue) => issue.severity === "critical"),
    ];
    const compatibilityIssues = readCompatibilityIssues(
      repairIssues.map((issue) => ({
        ...issue,
        where: issue.where.slice(0, 1024),
      })),
    );
    this.warnings.push(...importIssues);
    const right = answersOf(q, "right");
    const wrong = answersOf(q, "wrong");
    // The first right answer is the answer; the rest also count as right.
    const answerText = right[0] ?? null;
    if (
      !handledScript &&
      !award &&
      !compatibilityIssues?.length &&
      !body.text &&
      !body.textItems.some((item) => item.text.trim()) &&
      body.questionFiles.length === 0 &&
      modernBody?.answerType !== "point"
    ) {
      this.warnings.push({ code: "emptyQuestion", where });
      return null;
    }
    if (!answerText && body.answerFiles.length === 0 && !award && !handledScript)
      this.warnings.push({ code: "noAnswer", where });

    const firstType = body.questionFiles[0]?.file.type;
    const base: UploadQuestion = {
      ...(handledScript ? { type: normalized.fields.type } : normalized.fields),
      ...(compatibilityIssues ? { compatibilityIssues } : {}),
      order,
      price: roundType === "final" ? null : price,
      // Keep SI nominal prices for explicit final scripts and round extrema.
      ...(roundType === "final" && price > 0 ? { realPrice: price } : {}),
      text: body.text,
      textOrder: body.textOrder,
      textDurationMs: body.textDurationMs,
      textWaitForFinish: body.textWaitForFinish,
      answerTextItems: body.answerTextItems,
      answerDurationMs: body.answerDurationMs,
      showmanComments: child(child(q, "info"), "showmanComments")?.textContent?.trim() || null,
      ...(body.textItems.length ? { textItems: body.textItems } : {}),
      playMediaSimultaneously: true,
      questionComment: null,
      answerExplanation: comment(q),
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
    const answerType = modernBody?.answerType;
    const deviation = modernBody?.answerDeviation ?? NaN;
    if (answerType === "number" && right[0] != null) {
      const n = Number(right[0].replace(",", ".").replace(/\s/g, ""));
      if (Number.isFinite(n)) {
        base.answerType = "number";
        base.answerNumber = n;
        base.answerDeviation = Number.isFinite(deviation) ? deviation : null;
      }
    } else if (answerType === "point") {
      base.answerType = "point";
      const parsed = parseSiqPoint(right[0] ?? "", modernBody?.rawAnswerDeviation ?? null);
      base.answerPoint = parsed?.target ?? null;
      base.answerDeviation = parsed?.deviation ?? null;
      base.pointImageOrder = modernBody?.pointImageOrder ?? -1;
      if (!parsed) this.warnings.push({ code: "pointInvalid", where });
      if (base.pointImageOrder === -1) this.warnings.push({ code: "pointTargetMissing", where });
    }
    if (!handledScript && !award && (answerType === "select" || normalized.rawType === "choice")) {
      base.answerType = "select";
      base.showDelay = 0;
      base.rightAnswers = null;
      const options: NonNullable<UploadQuestion["answers"]> = [];
      const unresolvedOptions: NonNullable<
        NonNullable<UploadQuestion["selectSource"]>["unresolvedOptions"]
      > = [];
      const group = modernBody?.options;
      for (const option of children(group, "param")) {
        const sourceLabel = option.getAttribute("name") ?? "";
        const item = child(option, "item"); // SIEngine uses only the first content item.
        const kind = item?.getAttribute("type") ?? "text";
        const value = item ? text(item) : "";
        const order = options.length;
        const media = mediaType(kind);
        const file = media && value ? this.media(media, value, where) : null;
        const supported = kind === "text" ? !!value : !!file;
        options.push({ order, sourceLabel, text: kind === "text" ? value : null, file });
        if (!supported) unresolvedOptions.push({ order, sourceLabel, kind, value });
      }
      base.answers = options;
      const sourceRights = Array.from(children(child(q, "right"), "answer"), text);
      base.selectSource = { rightLabels: sourceRights, unresolvedOptions };
      const labels = options.map((option) => option.sourceLabel);
      const matches = options.filter((option) => option.sourceLabel === sourceRights[0]);
      if (
        options.length < 2 ||
        labels.some((label) => !label) ||
        new Set(labels).size !== labels.length ||
        matches.length !== 1 ||
        invalidSelectSource(base.selectSource, options) ||
        unresolvedOptions.length
      ) {
        base.correctChoiceNeedsRepair = true;
        const issue: ImportWarning = {
          code: "choiceCorrectUnresolved",
          where,
          severity: "critical",
          feature: "select",
          resolution: "needsRepair",
        };
        base.compatibilityIssues = readCompatibilityIssues([
          ...(base.compatibilityIssues ?? []),
          { ...issue, where: issue.where.slice(0, 1024) },
        ]);
        this.warnings.push(issue);
        base.answerText = null;
      } else {
        base.correctChoiceOrder = matches[0]!.order;
        base.answerText = matches[0]!.text;
      }
    }
    if (script?.issue) Object.assign(base, script.fields);
    if (script?.script) {
      Object.assign(base, script.fields, {
        script: script.script,
        textDurationMs: null,
        textWaitForFinish: null,
      });
      // Native compilation is safe only for an exact supported template, never a partial match.
      // Final special scripts retain the program so preamble precedes any native final bids.
      // Select groups in scripts can use labels in media and repeated asks. The
      // native choice editor cannot preserve their step-local keys.
      if (
        script.nativeKind &&
        roundType !== "final" &&
        !script.script.steps.some(
          (step) => step.op === "setAnswerType" && step.answerType === "select",
        )
      ) {
        const native = script.nativeKind;
        const type = native.startsWith("secret")
          ? "secret"
          : native === "stakeAll"
            ? "stake"
            : native === "forAll"
              ? "simple"
              : (native as UploadQuestion["type"]);
        base.type = type;
        // Existing v5 body is the native question/answer presentation for these exact ref templates.
        const formats = script.script.steps.filter((s) => s.op === "setAnswerType");
        const currentFormat = formats[0];
        base.answerType = currentFormat?.answerType ?? "text";
        const ask = script.script.steps.find((step) => step.op === "askAnswer");
        if (ask?.op === "askAnswer") base.answerDurationMs = ask.durationMs;
        if (type === "stake" || type === "secret" || type === "noRisk") base.subType = "simple";
        if (type === "stake") base.maxPrice = null;
        if (native === "stakeAll" || native === "forAll") base.subType = "forEveryone";
        if (native === "noRisk") base.priceMultiplier = 2;
        if (native.startsWith("secret")) {
          const transfer = script.script.steps.find(
            (step) => step.op === "setAnswerer" && step.mode === "byCurrent",
          );
          base.transferType =
            transfer?.op === "setAnswerer" && transfer.mode === "byCurrent"
              ? transfer.select
              : "exceptCurrent";
          const selection = script.script.steps.find(
            (s) => s.op === "setPrice" && s.mode === "select",
          );
          if (selection?.op === "setPrice" && selection.mode === "select") {
            const r = selection.range;
            if (r.min === r.max && r.min > 0) base.realPrice = r.min;
            base.secretRules = {
              outcome: native === "secretNoQuestion" ? "award" : "question",
              priceAnnouncement:
                native === "secret" || native === "secretNoQuestion"
                  ? "afterTransfer"
                  : "beforeTransfer",
              priceChooser: native === "secretOpenerPrice" ? "opener" : "receiver",
              priceRule:
                r.min === r.max
                  ? r.min === 0
                    ? { kind: "roundExtremes" }
                    : null
                  : { kind: "range", ...r },
            };
          }
        }
        base.script = null;
        if (base.answerType !== "select") delete base.answers;
      } else if (normalized.fields.type !== "simple") {
        // The upload schema still requires fields for the declared type of a scripted question.
        const { secretRules: _rules, realPrice: _price, ...typeFields } = normalized.fields;
        Object.assign(base, { subType: "simple", ...typeFields });
      }
    }
    return base;
  }

  /** Preserve every script content occurrence, including private replic and timed blank steps. */
  private readScriptContent(content: Element, where: string) {
    const textItems: NonNullable<UploadQuestion["textItems"]> = [];
    const questionFiles: QuestionFile[] = [];
    for (const [order, item] of [...children(content, "item")].entries()) {
      const kind = item.getAttribute("type") ?? "text";
      const placement = item.getAttribute("placement");
      if (placement != null && !["screen", "background", "replic"].includes(placement))
        throw new Error(`unknown content placement: ${placement}`);
      const rawDuration = item.getAttribute("duration");
      const durationMs = parseTimeSpan(rawDuration);
      if (rawDuration && durationMs === null && !isZeroDuration(rawDuration))
        throw new Error("invalid content duration");
      if (durationMs != null && durationMs > 120_000) throw new Error("content duration limit");
      const rawWait = item.getAttribute("waitForFinish")?.toLowerCase();
      if (rawWait != null && rawWait !== "true" && rawWait !== "false")
        throw new Error(`invalid waitForFinish: ${rawWait}`);
      const waitForFinish = rawWait !== "false";
      const value = text(item);
      if (kind === "text" || kind === "say") {
        if (placement === "background") throw new Error(`invalid ${kind} placement: ${placement}`);
        textItems.push({
          order,
          text: value,
          durationMs: durationMs ?? (!value ? 2000 : null),
          waitForFinish,
          placement: kind === "say" || placement === "replic" ? "replic" : "screen",
        });
      } else {
        const media = mediaType(kind);
        if (!media) throw new Error(`unknown content type: ${kind}`);
        if (placement === "replic" || (placement === "background" && media !== "audio"))
          throw new Error(`invalid ${kind} placement: ${placement}`);
        if (item.getAttribute("isRef")?.toLowerCase() !== "true" && /^https?:/i.test(value))
          throw new Error("external script media");
        const file = this.media(media, value, where);
        if (!file) throw new Error("missing script media");
        questionFiles.push({
          order,
          file,
          displayTime: durationMs,
          waitForFinish,
          placement:
            media === "audio" && (placement ?? "background") === "background"
              ? "background"
              : "screen",
        });
      }
    }
    return { textItems, questionFiles };
  }

  /** Format 5: <params><param name="question" type="content"><item …/></param>…</params> */
  private readV5(params: Element, where: string) {
    const byName = (n: string) =>
      [...children(params, "param")].find((p) => p.getAttribute("name") === n) ?? null;
    const question = byName("question") ?? params;
    const answer = byName("answer");
    const read = (param: Element | null) => {
      const entries: ContentEntry[] = [];
      const sourceItems = [...children(param, "item")];
      for (const [sourceIndex, item] of sourceItems.entries()) {
        const kind = item.getAttribute("type") ?? "text";
        const value = text(item);
        const rawWait = item.getAttribute("waitForFinish");
        if (rawWait != null && !["true", "false"].includes(rawWait.toLowerCase()))
          this.repair(where, "waitForFinish", rawWait, item);
        const waitForFinish = rawWait?.toLowerCase() !== "false";
        const rawDuration = item.getAttribute("duration");
        const durationMs = parseTimeSpan(rawDuration);
        if (rawDuration && durationMs === null && !isZeroDuration(rawDuration))
          this.repair(where, "duration", rawDuration, item);
        if (durationMs != null && durationMs > 120_000)
          this.repair(where, "duration", rawDuration ?? "", item);
        const placement = item.getAttribute("placement");
        if (placement != null && !["screen", "background", "replic"].includes(placement))
          this.repair(where, "placement", placement, item);
        if (kind === "text" || kind === "say") {
          if (placement === "background") this.repair(where, "placement", placement, item);
          const said = placement === "replic" || kind === "say";
          entries.push({
            sourceIndex,
            kind: said ? "said" : "text",
            value,
            placement: said ? "replic" : "screen",
            waitForFinish,
            durationMs,
          });
          continue;
        }
        const media = mediaType(kind);
        if (!media) {
          this.repair(where, "contentType", kind, item);
          entries.push({ kind: "said", value: "", placement: "replic", waitForFinish, durationMs });
          continue;
        }
        if (placement === "replic" || (placement === "background" && media !== "audio"))
          this.repair(where, "placement", placement, item);
        if (!value) this.repair(where, "contentType", `${kind}: empty reference`, item);
        if (item.getAttribute("isRef")?.toLowerCase() !== "true" && /^https?:/i.test(value)) {
          this.warnings.push({ code: "externalMedia", where, detail: value });
          entries.push({
            sourceIndex,
            kind: "file",
            placement: "screen",
            waitForFinish,
            durationMs,
          });
          continue;
        }
        const ref = this.media(media, value, where);
        // SIGame plays audio in the background unless the item says otherwise.
        const filePlacement =
          media === "audio" && (item.getAttribute("placement") ?? "background") === "background"
            ? "background"
            : "screen";
        entries.push({
          sourceIndex,
          kind: "file",
          file: ref ?? undefined,
          placement: filePlacement,
          waitForFinish,
          durationMs,
        });
      }
      const sequence = toSequence(entries);
      return {
        ...sequence,
        pointImageOrder: pointTargetOrder(sourceItems.length - 1, sequence.occurrences) ?? -1,
      };
    };
    const asked = read(question);
    const shown = read(answer);
    return {
      text: asked.text,
      textOrder: asked.textOrder,
      textDurationMs: asked.textDurationMs,
      textWaitForFinish: asked.textWaitForFinish,
      textItems: asked.textItems,
      questionFiles: asked.files,
      answerFiles: shown.files,
      pointImageOrder: asked.pointImageOrder,
      rawAnswerDeviation: byName("answerDeviation") ? text(byName("answerDeviation")!) : null,
      answerTextItems: shown.allTextItems,
      answerDurationMs: this.answerDuration(byName("answerDuration"), where),
      answerType: byName("answerType") ? text(byName("answerType")!) : null,
      answerDeviation: byName("answerDeviation") ? Number(text(byName("answerDeviation")!)) : null,
      options: byName("answerOptions"),
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
      // SIGame: time -1 means "do not wait"; a positive time is the duration in seconds.
      const rawTime = atom.getAttribute("time");
      const time = Number(rawTime ?? "0");
      if (!Number.isFinite(time) || (time < 0 && time != -1) || time * 1000 > 120_000)
        this.repair(where, "duration", rawTime ?? "", atom);
      const waitForFinish = time !== -1;
      const durationMs = Number.isFinite(time) && time > 0 ? Math.round(time * 1000) : null;
      const into = afterMarker ? shown : asked;
      if (kind === "text" || kind === "say") {
        into.push({
          kind: kind === "say" ? "said" : "text",
          value,
          placement: kind === "say" ? "replic" : "screen",
          waitForFinish,
          durationMs,
        });
        continue;
      }
      const media = mediaType(kind);
      if (!media) {
        this.repair(where, "contentType", kind, atom);
        continue;
      }
      if (!value.startsWith("@") && /^https?:/i.test(value)) {
        this.warnings.push({ code: "externalMedia", where, detail: value });
        into.push({ kind: "file", placement: "screen", waitForFinish, durationMs });
        continue;
      }
      const ref = this.media(media, value, where);
      into.push({
        kind: "file",
        file: ref ?? undefined,
        placement: kind === "voice" ? "background" : "screen",
        waitForFinish,
        durationMs,
      });
    }
    const q = toSequence(asked);
    const a = toSequence(shown);
    return {
      text: q.text,
      textOrder: q.textOrder,
      textDurationMs: q.textDurationMs,
      textWaitForFinish: q.textWaitForFinish,
      textItems: q.textItems,
      questionFiles: q.files,
      answerFiles: a.files,
      answerTextItems: a.allTextItems,
      answerDurationMs: null,
    };
  }

  private repair(where: string, feature: string, value: string, item?: Element) {
    this.warnings.push({
      code: "contentNeedsRepair",
      ...(item
        ? {
            contentSource: {
              type: (item.getAttribute("type") ?? "text").slice(0, 100),
              text: (item.textContent ?? "").slice(0, 2000),
              placement: item.getAttribute("placement")?.slice(0, 100) ?? null,
              duration: item.getAttribute("duration")?.slice(0, 100) ?? null,
              waitForFinish: item.getAttribute("waitForFinish")?.slice(0, 16) ?? null,
              time: item.getAttribute("time")?.slice(0, 100) ?? null,
            },
          }
        : {}),
      where,
      feature,
      detail: value.slice(0, 500),
      severity: "critical",
      resolution: "needsRepair",
    });
  }

  private answerDuration(param: Element | null, where: string): number | null {
    if (!param) return null;
    const raw = text(param);
    if (
      !/^\d+$/.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) * 1000 > 2147483647
    ) {
      this.repair(where, "answerDuration", raw);
      return null;
    }
    return Number(raw) === 0 ? null : Number(raw) * 1000;
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

/** Keep source occurrences in one order space, including blank screen clears and private pauses. */
function toSequence(entries: ContentEntry[]) {
  const files: QuestionFile[] = [];
  const occurrences: { sourceIndex: number; order: number; kind: string }[] = [];
  const allTextItems: QuestionTextItem[] = [];
  for (const [order, entry] of entries.entries()) {
    if (entry.kind === "file") {
      if (entry.file) {
        files.push({
          file: entry.file,
          order,
          displayTime: entry.durationMs,
          ...(entry.placement === "background" ? { placement: "background" as const } : {}),
          ...(entry.waitForFinish === false ? { waitForFinish: false } : {}),
        });
        if (entry.sourceIndex != null)
          occurrences.push({ sourceIndex: entry.sourceIndex, order, kind: entry.file.type });
      }
    } else {
      allTextItems.push({
        order,
        text: entry.value ?? "",
        durationMs: entry.durationMs ?? (!entry.value?.trim() ? 2000 : null),
        waitForFinish: entry.waitForFinish,
        placement: entry.kind === "said" ? "replic" : "screen",
      });
    }
  }
  const main = allTextItems.find((item) => item.placement === "screen" && item.text.trim());
  const caption =
    main?.durationMs == null &&
    ((entries.length === 1 && main?.waitForFinish !== false) ||
      (main?.order === 0 &&
        main.waitForFinish === false &&
        files.length > 0 &&
        allTextItems.filter((item) => item.placement === "screen").length === 1));
  return {
    text: main?.text ?? null,
    textOrder: main && !caption ? main.order : null,
    textDurationMs: main?.durationMs ?? null,
    textWaitForFinish: main?.waitForFinish ?? null,
    textItems: allTextItems.filter((item) => item !== main),
    allTextItems,
    files,
    occurrences,
  };
}

/** Inspect original entries before missing files, unsupported content or extra finals are removed. */
export function scanSiqContentLimits(pkg: Element): ImportWarning[] {
  const issues: ImportLimitIssue[] = [];
  const warnings: ImportWarning[] = [];
  for (const round of children(child(pkg, "rounds"), "round")) {
    const roundName = round.getAttribute("name")?.trim() || "—";
    for (const theme of children(child(round, "themes"), "theme")) {
      const themeName = theme.getAttribute("name")?.trim() || "—";
      const questions = [...children(child(theme, "questions"), "question")];
      questions.forEach((question, index) => {
        const groups = siqGroupSizes(question);
        for (const phase of ["question", "answer"] as const) {
          issues.push(
            ...timelineLimitIssues(phase, groups[phase]).map((issue) => ({
              ...issue,
              round: roundName,
              theme: themeName,
              number: index + 1,
            })),
          );
          groups[phase].forEach(({ visuals }, step) => {
            if (visuals < VISUAL_QUEUE_THRESHOLD) return;
            warnings.push({
              code: "visualGroupSequential",
              where: `${roundName} › ${themeName} › ${question.getAttribute("price") ?? index + 1}`,
              phase,
              detail: String(step + 1),
            });
          });
        }
      });
    }
  }
  if (issues.length) throw new PackageContentLimitError(issues);
  return warnings;
}

function siqGroupSizes(question: Element) {
  const resolved = resolveSiqQuestionParameters(question, "");
  const params = child(resolved.question, "params");
  const groups: Record<TimelinePhase, TimelineGroupSize[]> = { question: [], answer: [] };
  let phase: TimelinePhase = "question";
  let group: TimelineGroupSize | null = null;
  const close = () => {
    if (group) groups[phase].push(group);
    group = null;
  };
  const count = (item: Element, waits: boolean) => {
    const type = item.getAttribute("type") ?? "text";
    const media = mediaType(type);
    group ??= { files: 0, visuals: 0 };
    if (media || (type !== "text" && type !== "say")) group.files++;
    if (media === "image" || media === "video") group.visuals++;
    if (waits) close();
  };
  const script = child(question, "script");
  if (script) {
    const byName = (parent: Element | null, name: string) =>
      [...children(parent, "param")].find((item) => item.getAttribute("name") === name) ?? null;
    for (const step of children(script, "step")) {
      const op = step.getAttribute("type") ?? "showContent";
      if (op === "askAnswer") {
        phase = "answer";
        continue;
      }
      if (op !== "showContent") continue;
      const operand = byName(step, "content");
      const source =
        operand?.getAttribute("isRef")?.toLowerCase() === "true"
          ? byName(params, text(operand))
          : operand;
      if (!source && byName(step, "fallbackRefId")?.textContent?.trim() === "right")
        groups[phase].push({ files: 0, visuals: 0 });
      for (const item of children(source, "item")) {
        const media = mediaType(item.getAttribute("type") ?? "text");
        group ??= { files: 0, visuals: 0 };
        if (media) group.files++;
        if (media === "image" || media === "video") group.visuals++;
        if (item.getAttribute("waitForFinish")?.toLowerCase() !== "false") close();
      }
      close();
    }
  } else if (params) {
    const parts = [...children(params, "param")];
    for (const name of ["question", "answer"] as const) {
      phase = name;
      const part = parts.find((element) => element.getAttribute("name") === name);
      const source = part ?? (name === "question" ? params : null);
      for (const item of children(source, "item")) {
        count(item, item.getAttribute("waitForFinish")?.toLowerCase() !== "false");
      }
      close();
    }
  } else {
    for (const atom of children(child(question, "scenario"), "atom")) {
      if (atom.getAttribute("type") === "marker") {
        close();
        phase = "answer";
      } else {
        count(atom, Number.parseFloat(atom.getAttribute("time") ?? "0") !== -1);
      }
    }
    close();
  }
  return groups;
}

function isZeroDuration(raw: string): boolean {
  return /^(?:0|(?:0\.)?00:00:00(?:\.0+)?)$/.test(raw.trim());
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
  return Number.isSafeInteger(ms) &&
    Number(h) < 24 &&
    Number(min) < 60 &&
    Number(sec) < 60 &&
    ms > 0
    ? ms
    : null;
}
