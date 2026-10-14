import * as RD from "@radix-ui/react-dialog";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { FieldError, inputClass, Label, TextInput } from "@/ui/Field";
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon, UploadIcon } from "@/ui/icons";

import { PointPicker } from "@/features/game/play/PointPicker";

import { LinesField } from "./LinesField";
import { mediaUrl, readMediaFile } from "./media";
import { newId, QUESTION_TYPES, type EditorMedia, type EditorQuestion } from "./model";
import * as ops from "./ops";
import { MediaView, QuestionPreview } from "./QuestionPreview";
import { useEditor } from "./store";
import { MAX_PRICE } from "./validate";

/**
 * The question form. Edits are staged and land as one undo step on Save;
 * closing with changes asks first. Full screen on phones.
 */
export function QuestionDialog() {
  const id = useEditor((s) => s.editingId);
  const pkg = useEditor((s) => s.pkg);
  const at = id ? ops.findQuestion(pkg, id) : null;
  const edit = useEditor((s) => s.edit);
  const readOnly = useEditor((s) => s.readOnly);
  if (!at) return null;
  if (readOnly) return <QuestionView at={at} onClose={() => edit(null)} />;
  return <QuestionForm key={at.question.id} at={at} onClose={() => edit(null)} />;
}

/** A published package's question, to look at only. */
function QuestionView({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${at.round.name || "—"} › ${at.theme.name || "—"}`}
      closeLabel={t("common.close")}
    >
      <div className="p-5" data-testid="question-view">
        <QuestionPreview question={at.question} final={at.round.type === "final"} />
      </div>
    </Dialog>
  );
}

function QuestionForm({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const final = at.round.type === "final";
  const [q, setQ] = useState<EditorQuestion>(at.question);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = q !== at.question;
  const set = (patch: Partial<EditorQuestion>) => setQ((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (dirty) apply((p) => ops.updateQuestion(p, q.id, q), { key: "questionSaved" });
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  return (
    <RD.Root open onOpenChange={(o) => !o && requestClose()}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim/70 oq-pop" />
        <RD.Content
          data-testid="question-dialog"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          className="fixed inset-0 z-50 flex flex-col border-line-strong bg-surface text-text outline-none oq-slide-up md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(860px,calc(100dvh-48px))] md:w-[min(1120px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-faint">
                {at.round.name || "—"} › {at.theme.name || "—"}
              </span>
              <RD.Title className="m-0 font-display text-xl font-extrabold sm:text-2xl">
                {final
                  ? t("editor.form.finalTitle")
                  : t("editor.form.title", { price: q.price ?? "—" })}
              </RD.Title>
            </div>
            <RD.Description className="sr-only">{t("editor.form.description")}</RD.Description>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={requestClose}
              className="inline-flex size-11 items-center justify-center rounded-sm border border-line-strong hover:bg-surface-2"
            >
              <CloseIcon size={18} />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6">
              {!final && (
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2 text-[15px] font-semibold">
                    {t("editor.form.type")}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={q.type === type}
                        onClick={() => set(changeType(q, type))}
                        className={cn(
                          "flex min-h-16 flex-col items-start gap-1 rounded-[12px] border-2 px-3 py-2 text-left",
                          q.type === type
                            ? "border-accent bg-accent-surface text-accent-soft"
                            : "border-line bg-surface-2 text-muted hover:border-line-strong",
                        )}
                      >
                        <span
                          className={cn(
                            "font-bold",
                            q.type === type ? "text-accent-strong" : "text-text",
                          )}
                        >
                          {t(`questionTypes.${type}`)}
                        </span>
                        <span className="text-xs">{t(`editor.form.typeHelp.${type}`)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className={cn("grid gap-4", !final && "sm:grid-cols-[160px_1fr]")}>
                {!final && (
                  <NumberField
                    id="qf-price"
                    label={t("editor.form.price")}
                    value={q.price}
                    onChange={(price) => set({ price })}
                    error={
                      q.price == null
                        ? t("editor.issues.noPrice")
                        : q.price < 0 || q.price > MAX_PRICE
                          ? t("editor.issues.priceRange", { max: MAX_PRICE })
                          : undefined
                    }
                  />
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qf-text">{t("editor.form.text")}</Label>
                  <textarea
                    id="qf-text"
                    autoFocus
                    rows={3}
                    value={q.text}
                    onChange={(e) => set({ text: e.target.value })}
                    placeholder={t("editor.form.textPlaceholder")}
                    className={cn(inputClass, "min-h-24 resize-y py-3")}
                  />
                </div>
              </div>

              <MediaList
                label={t("editor.form.questionMedia")}
                help={t("editor.form.questionMediaHelp")}
                files={q.questionFiles}
                onChange={(questionFiles) => set({ questionFiles })}
              />
              {!q.text.trim() && q.questionFiles.length === 0 && (
                <FieldError>{t("editor.issues.questionEmpty")}</FieldError>
              )}
              {q.text.trim() && q.questionFiles.length > 0 && (
                <Check
                  checked={q.textPosition != null}
                  onChange={(on) => set({ textPosition: on ? 0 : null })}
                  label={t("editor.form.textFirst")}
                />
              )}

              {!final && q.type === "choice" && <ChoiceOptions q={q} set={set} />}

              {(final || q.type !== "choice") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="qf-answer">{t("editor.form.answer")}</Label>
                    <TextInput
                      id="qf-answer"
                      value={q.answerText}
                      onChange={(e) => set({ answerText: e.target.value })}
                      className={q.answerText.trim() ? "border-success-line" : undefined}
                    />
                    <span className="text-sm text-faint">{t("editor.form.answerHelp")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="qf-hint">
                      {t("editor.form.hint")}{" "}
                      <span className="font-normal text-faint">{t("editor.optional")}</span>
                    </Label>
                    <TextInput
                      id="qf-hint"
                      value={q.answerHint}
                      onChange={(e) => set({ answerHint: e.target.value })}
                    />
                    <span className="text-sm text-faint">{t("editor.form.hintHelp")}</span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <LinesField
                  id="qf-right"
                  label={t("editor.form.rightAnswers")}
                  help={t("editor.form.rightAnswersHelp")}
                  value={q.rightAnswers}
                  onChange={(rightAnswers) => set({ rightAnswers })}
                />
                <LinesField
                  id="qf-wrong"
                  label={t("editor.form.wrongAnswers")}
                  help={t("editor.form.wrongAnswersHelp")}
                  value={q.wrongAnswers}
                  onChange={(wrongAnswers) => set({ wrongAnswers })}
                />
              </div>

              <MediaList
                label={t("editor.form.answerMedia")}
                help={t("editor.form.answerMediaHelp")}
                files={q.answerFiles}
                onChange={(answerFiles) => set({ answerFiles })}
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qf-comment">
                  {t("editor.form.comment")}{" "}
                  <span className="font-normal text-faint">{t("editor.optional")}</span>
                </Label>
                <TextInput
                  id="qf-comment"
                  value={q.questionComment}
                  onChange={(e) => set({ questionComment: e.target.value })}
                />
                <span className="text-sm text-faint">{t("editor.form.commentHelp")}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <LinesField
                  id="qf-authors"
                  label={t("editor.form.authors")}
                  value={q.authors}
                  onChange={(authors) => set({ authors })}
                />
                <LinesField
                  id="qf-sources"
                  label={t("editor.form.sources")}
                  help={t("editor.form.sourcesHelp")}
                  value={q.sources}
                  onChange={(sources) => set({ sources })}
                />
              </div>

              <div className="lg:hidden">
                <TypeSettings q={q} set={set} final={final} />
              </div>
            </div>

            <aside className="hidden w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-bg/40 p-5 lg:flex">
              <TypeSettings q={q} set={set} final={final} />
              <div className="h-px bg-line" />
              <span className="text-xs font-bold tracking-[0.08em] text-faint uppercase">
                {t("editor.form.preview")}
              </span>
              <QuestionPreview question={q} final={final} compact />
            </aside>
          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-6">
            {confirmClose ? (
              <>
                <span role="alert" className="flex-1 font-semibold text-warning">
                  {t("editor.form.unsaved")}
                </span>
                <Button variant="danger" onClick={onClose}>
                  {t("editor.form.discard")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClose(false)}>
                  {t("editor.form.keepEditing")}
                </Button>
              </>
            ) : (
              <>
                <span className="hidden flex-1 text-sm text-faint sm:block">
                  {t("editor.form.saveShortcut")}
                </span>
                <div className="flex flex-1 justify-end gap-3 sm:flex-none">
                  <Button variant="ghost" size="lg" onClick={requestClose}>
                    {t("editor.cancel")}
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    onClick={save}
                    icon={<CheckIcon size={18} />}
                    data-testid="question-save"
                  >
                    {t("editor.form.save")}
                  </Button>
                </div>
              </>
            )}
          </footer>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Switching type keeps text, answer and media; choice gets two empty options to start. */
function changeType(q: EditorQuestion, type: EditorQuestion["type"]): Partial<EditorQuestion> {
  if (type === "choice" && q.options.length === 0)
    return {
      type,
      options: [
        { id: newId(), text: q.answerText, file: null },
        { id: newId(), text: "", file: null },
      ],
    };
  return { type };
}

function NumberField({
  id,
  label,
  value,
  onChange,
  help,
  error,
  allowEmpty,
  step,
}: {
  id: string;
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
  error?: string;
  allowEmpty?: boolean;
  step?: number;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    // Keep what's typed ("1." while typing 1.5) when it already means this value.
    if (!(text !== "" && Number(text) === value)) setText(value == null ? "" : String(value));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.-]/g, "");
          setText(v);
          if (v === "") onChange(allowEmpty ? null : null);
          else if (!Number.isNaN(Number(v))) onChange(step ? Number(v) : Math.round(Number(v)));
        }}
      />
      {help && <span className="text-sm text-faint">{help}</span>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

function SecondsField({
  id,
  label,
  ms,
  onChange,
}: {
  id: string;
  label: string;
  ms: number;
  onChange: (ms: number) => void;
}) {
  return (
    <NumberField
      id={id}
      label={label}
      value={Math.round(ms / 100) / 10}
      step={0.5}
      onChange={(s) => onChange(Math.max(0, Math.round((s ?? 0) * 1000)))}
    />
  );
}

function TypeSettings({
  q,
  set,
  final,
}: {
  q: EditorQuestion;
  set: (p: Partial<EditorQuestion>) => void;
  final: boolean;
}) {
  const { t } = useTranslation();
  const type = final ? "simple" : q.type;
  return (
    <div className="flex flex-col gap-4">
      {type !== "simple" && type !== "hidden" && (
        <span className="text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
          {t("editor.form.settingsFor", { type: t(`questionTypes.${type}`) })}
        </span>
      )}
      {type === "stake" && (
        <>
          <NumberField
            id="qf-max"
            label={t("editor.form.maxBid")}
            value={q.maxPrice}
            allowEmpty
            help={t("editor.form.maxBidHelp")}
            onChange={(maxPrice) => set({ maxPrice })}
          />
          <Check
            checked={q.forEveryone}
            onChange={(forEveryone) => set({ forEveryone })}
            label={t("editor.form.stakeEveryone")}
          />
        </>
      )}
      {type === "noRisk" && (
        <>
          <NumberField
            id="qf-mult"
            label={t("editor.form.multiplier")}
            value={q.priceMultiplier}
            step={0.5}
            onChange={(v) => set({ priceMultiplier: v ?? 1 })}
          />
          <Check
            checked={q.forEveryone}
            onChange={(forEveryone) => set({ forEveryone })}
            label={t("editor.form.noRiskEveryone")}
          />
        </>
      )}
      {type === "secret" && (
        <>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1.5 text-[15px] font-semibold">
              {t("editor.form.transferTitle")}
            </legend>
            {(["any", "exceptCurrent"] as const).map((v) => (
              <label key={v} className="flex min-h-10 items-center gap-2.5">
                <input
                  type="radio"
                  name="qf-transfer"
                  checked={q.transferType === v}
                  onChange={() => set({ transferType: v })}
                />
                {t(`editor.form.transfer.${v}`)}
              </label>
            ))}
          </fieldset>
          <PricesField
            value={q.allowedPrices}
            onChange={(allowedPrices) => set({ allowedPrices })}
          />
        </>
      )}
      {type === "choice" && (
        <SecondsField
          id="qf-showdelay"
          label={t("editor.form.showDelay")}
          ms={q.showDelay}
          onChange={(showDelay) => set({ showDelay })}
        />
      )}
      {type !== "choice" && !final && <AnswerCheckSettings q={q} set={set} />}
      <span className="text-xs font-bold tracking-[0.08em] text-faint uppercase">
        {t("editor.form.timing")}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <SecondsField
          id="qf-delay"
          label={t("editor.form.answerDelay")}
          ms={q.answerDelay}
          onChange={(answerDelay) => set({ answerDelay })}
        />
        <SecondsField
          id="qf-reveal"
          label={t("editor.form.showAnswer")}
          ms={q.showAnswerDuration}
          onChange={(showAnswerDuration) => set({ showAnswerDuration })}
        />
      </div>
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function PricesField({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value.join(", "));
  const bad = value.length > 0 && (value.length < 2 || value.length > 5);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="qf-prices">{t("editor.form.allowedPrices")}</Label>
      <TextInput
        id="qf-prices"
        value={text}
        placeholder="100, 300, 500"
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number)
              .filter((n) => Number.isFinite(n)),
          );
        }}
      />
      <span className="text-sm text-faint">{t("editor.form.allowedPricesHelp")}</span>
      <FieldError>
        {bad ? t("editor.issues.secretPrices", { count: value.length }) : undefined}
      </FieldError>
    </div>
  );
}

function ChoiceOptions({
  q,
  set,
}: {
  q: EditorQuestion;
  set: (p: Partial<EditorQuestion>) => void;
}) {
  const { t } = useTranslation();
  const correct = q.answerText.trim();
  const update = (id: string, text: string) => {
    const old = q.options.find((o) => o.id === id);
    const wasCorrect = old && old.text.trim() === correct && correct !== "";
    set({
      options: q.options.map((o) => (o.id === id ? { ...o, text } : o)),
      ...(wasCorrect ? { answerText: text } : {}),
    });
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-[15px] font-semibold">{t("editor.form.options")}</legend>
      <span className="text-sm text-faint">{t("editor.form.optionsHelp")}</span>
      {q.options.map((o, i) => {
        const isCorrect = correct !== "" && o.text.trim() === correct;
        return (
          <div key={o.id} className="flex items-center gap-2">
            <span className="w-5 text-center font-semibold text-muted">
              {String.fromCharCode(65 + i)}
            </span>
            <TextInput
              aria-label={t("editor.form.option", { letter: String.fromCharCode(65 + i) })}
              value={o.text}
              onChange={(e) => update(o.id, e.target.value)}
              className={isCorrect ? "border-success-line" : undefined}
            />
            <label
              className={cn(
                "flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold",
                isCorrect
                  ? "border-success-line bg-success-surface text-success"
                  : "border-line-strong text-muted",
              )}
            >
              <input
                type="radio"
                name="qf-correct"
                checked={isCorrect}
                onChange={() => set({ answerText: o.text })}
              />
              {t("editor.form.correct")}
            </label>
            <button
              type="button"
              aria-label={t("editor.form.removeOption", { letter: String.fromCharCode(65 + i) })}
              onClick={() => set({ options: q.options.filter((x) => x.id !== o.id) })}
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line-strong text-muted hover:text-danger"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        );
      })}
      {q.options.length < 8 && (
        <Button
          size="sm"
          className="self-start"
          icon={<PlusIcon size={16} />}
          onClick={() => set({ options: [...q.options, { id: newId(), text: "", file: null }] })}
        >
          {t("editor.form.addOption")}
        </Button>
      )}
    </fieldset>
  );
}

function MediaList({
  label,
  help,
  files,
  onChange,
}: {
  label: string;
  help: string;
  files: EditorMedia[];
  onChange: (files: EditorMedia[]) => void;
}) {
  const { t } = useTranslation();
  const addMedia = useEditor((s) => s.addMedia);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async (list: FileList | File[]) => {
    setError(null);
    setBusy(true);
    const added: EditorMedia[] = [];
    for (const f of list) {
      try {
        const file = await readMediaFile(f);
        addMedia([file]);
        added.push({
          md5: file.md5,
          type: file.type,
          displayTime: file.type === "image" ? 5000 : null,
        });
      } catch (err) {
        setError(
          t(`editor.media.errors.${err instanceof Error ? err.message : "mediaType"}`, {
            name: f.name,
          }),
        );
      }
    }
    setBusy(false);
    if (added.length) onChange([...files, ...added]);
  };
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    setOver(false);
    void add(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,audio/*,video/*"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void add([...e.target.files]);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          icon={<UploadIcon size={16} />}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? t("editor.media.reading") : t("editor.media.add")}
        </Button>
      </div>
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-wrap gap-3 rounded-md border-2 border-dashed p-2.5",
          over ? "border-accent bg-accent-surface" : "border-line",
        )}
      >
        {files.map((m, i) => (
          <div
            key={`${m.md5}-${i}`}
            className="flex w-full flex-col gap-2 rounded-sm border border-line bg-surface-2 p-2 sm:w-[220px]"
          >
            <MediaView media={m} className={m.type === "image" ? "h-28 w-full" : "w-full"} />
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-soft">{t(`editor.media.${m.type}`)}</span>
              {m.type === "image" && (
                <label className="flex items-center gap-1.5 text-faint">
                  {t("editor.media.show")}
                  <input
                    inputMode="decimal"
                    value={m.displayTime == null ? "" : String(m.displayTime / 1000)}
                    onChange={(e) => {
                      const s = Number(e.target.value.replace(",", "."));
                      onChange(
                        files.map((f, j) =>
                          j === i
                            ? {
                                ...f,
                                displayTime:
                                  e.target.value === "" || Number.isNaN(s)
                                    ? null
                                    : Math.round(s * 1000),
                              }
                            : f,
                        ),
                      );
                    }}
                    className="min-h-8 w-14 rounded-[8px] border border-line-strong bg-bg px-2 text-text"
                  />
                  {t("editor.secondsShort")}
                </label>
              )}
              <button
                type="button"
                aria-label={t("editor.media.remove")}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="inline-flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-danger"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}
        <span className="flex min-h-12 flex-1 items-center justify-center px-2 text-center text-sm text-faint">
          {files.length ? t("editor.media.dropMore") : help}
        </span>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** How players answer: typed/said, a number, or a spot on the first picture. */
function AnswerCheckSettings({
  q,
  set,
}: {
  q: EditorQuestion;
  set: (p: Partial<EditorQuestion>) => void;
}) {
  const { t } = useTranslation();
  const image = q.questionFiles.find((f) => f.type === "image");
  const file = useEditor((s) => (image ? s.media.get(image.md5) : undefined));
  const src = mediaUrl(file);
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="qf-answer-type">{t("editor.form.answerType")}</Label>
      <select
        id="qf-answer-type"
        value={q.answerType}
        onChange={(e) =>
          set({ answerType: e.target.value as EditorQuestion["answerType"], answerDeviation: null })
        }
        className={inputClass}
      >
        {(["text", "number", "point"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`editor.form.answerTypes.${v}`)}
          </option>
        ))}
      </select>
      {q.answerType === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="qf-number"
            label={t("editor.form.answerNumber")}
            value={q.answerNumber}
            allowEmpty
            onChange={(answerNumber) => set({ answerNumber })}
            error={q.answerNumber == null ? t("editor.form.answerNumberMissing") : undefined}
          />
          <NumberField
            id="qf-deviation"
            label={t("editor.form.deviation")}
            value={q.answerDeviation}
            allowEmpty
            help={t("editor.form.deviationHelp")}
            onChange={(answerDeviation) => set({ answerDeviation })}
          />
        </div>
      )}
      {q.answerType === "point" &&
        (src ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-faint">{t("editor.form.pointHelp")}</span>
            <PointPicker
              src={src}
              target={q.answerPoint}
              radius={q.answerDeviation}
              onPick={(answerPoint) => set({ answerPoint })}
            />
            <NumberField
              id="qf-radius"
              label={t("editor.form.radius")}
              value={q.answerDeviation == null ? null : Math.round(q.answerDeviation * 100)}
              allowEmpty
              help={t("editor.form.radiusHelp")}
              onChange={(v) => set({ answerDeviation: v == null ? null : v / 100 })}
            />
          </div>
        ) : (
          <FieldError>{t("editor.form.pointNeedsImage")}</FieldError>
        ))}
    </div>
  );
}
