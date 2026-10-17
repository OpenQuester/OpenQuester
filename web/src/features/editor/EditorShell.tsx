import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import {
  BackIcon,
  CardsIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  ListIcon,
  MoveIcon,
  PlusIcon,
  RedoIcon,
  TrashIcon,
  SearchIcon,
  UndoIcon,
  UploadIcon,
} from "@/ui/icons";

import { InlineText } from "./InlineText";
import { downloadBlob, ExportMediaError, exportOq, safeFileName } from "./media";
import { countQuestions, newRound, reachableMedia } from "./model";
import { PasteQuestionsDialog, RoundPricesDialog, SearchDialog } from "./EditorTools";
import { MoveDialog, type MoveTarget } from "./MoveDialog";
import * as ops from "./ops";
import { Outline } from "./Outline";
import { PackageDialog } from "./PackageDialog";
import { PublishDialog } from "./PublishDialog";
import { QuestionDialog } from "./QuestionDialog";
import { QuestionPreview } from "./QuestionPreview";
import { RoundBoard, type BoardActions } from "./RoundBoard";
import { useEditor, useEditorStore } from "./store";
import { validate, type Issue } from "./validate";
import { ImportWarnings } from "@/features/upload/ImportWarnings";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type Confirm = { kind: "theme" | "round"; id: string; name: string; questions: number };

/** `header` replaces the editing header, e.g. for a read-only preview. */
export function EditorShell({ header }: { header?: React.ReactNode } = {}) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const readOnly = useEditor((s) => s.readOnly);
  const pkg = useEditor((s) => s.pkg);
  const media = useEditor((s) => s.media);
  const roundId = useEditor((s) => s.roundId);
  const selectedId = useEditor((s) => s.selectedId);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const selectRound = useEditor((s) => s.selectRound);
  const edit = useEditor((s) => s.edit);
  const wide = useMediaQuery("(min-width: 1280px)");

  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [pricesRound, setPricesRound] = useState<string | null>(null);
  const [pasteRound, setPasteRound] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [details, setDetails] = useState(false);
  const [publish, setPublish] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const report = useMemo(() => validate(pkg, (md5) => media.has(md5)), [pkg, media]);
  const roundIndex = Math.max(
    0,
    pkg.rounds.findIndex((r) => r.id === roundId),
  );
  const round = pkg.rounds[roundIndex];
  const selected = selectedId ? ops.findQuestion(pkg, selectedId) : null;

  // Keep a valid round open when rounds are deleted or undone away.
  useEffect(() => {
    if (!pkg.rounds.some((r) => r.id === roundId)) selectRound(pkg.rounds[0]?.id ?? null);
  }, [pkg.rounds, roundId, selectRound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      if (e.shiftKey) store.getState().redo();
      else store.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const addRound = () => {
    const r = newRound("");
    apply((p) => ops.addRound(p, r), { key: "roundAdded" });
    selectRound(r.id);
  };

  const actions: BoardActions = {
    open: (id) => (wide ? select(id) : edit(id)),
    edit,
    move: (id) => setMoveTarget({ kind: "question", id }),
    duplicate: (id) => {
      const { pkg: next, id: copy } = ops.duplicateQuestion(store.getState().pkg, id);
      apply(() => next, { key: "duplicated" });
      select(copy);
    },
    remove: (id) => {
      apply((p) => ops.deleteQuestion(p, id), { key: "questionDeleted" });
      if (store.getState().selectedId === id) select(null);
    },
    moveTheme: (id) => setMoveTarget({ kind: "theme", id }),
    setPrices: (roundId) => setPricesRound(roundId),
    pasteQuestions: (roundId) => setPasteRound(roundId),
    removeTheme: (id) => {
      const at = ops.findTheme(store.getState().pkg, id);
      if (!at) return;
      if (at.theme.questions.length === 0)
        apply((p) => ops.deleteTheme(p, id), { key: "themeDeleted" });
      else
        setConfirm({
          kind: "theme",
          id,
          name: at.theme.name,
          questions: at.theme.questions.length,
        });
    },
    removeRound: (id) => {
      const at = ops.findRound(store.getState().pkg, id);
      if (!at) return;
      const questions = at.round.themes.reduce((n, th) => n + th.questions.length, 0);
      if (questions === 0 && at.round.themes.length === 0)
        apply((p) => ops.deleteRound(p, id), { key: "roundDeleted" });
      else setConfirm({ kind: "round", id, name: at.round.name, questions });
    },
  };

  const jumpTheme = (rid: string, themeId: string) => {
    selectRound(rid);
    requestAnimationFrame(() => {
      const el = document.getElementById(`theme-name-${themeId}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  };
  const jump = (issue: Issue) => {
    const tg = issue.target;
    if (tg.kind === "package") setDetails(true);
    if (tg.kind === "round") selectRound(tg.id);
    if (tg.kind === "theme") jumpTheme(tg.roundId, tg.id);
    if (tg.kind === "question") {
      selectRound(tg.roundId);
      edit(tg.id);
    }
  };

  const importWarnings = useEditor((s) => s.importWarnings);
  const dismissImportWarnings = useEditor((s) => s.dismissImportWarnings);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportDraft = async () => {
    setExportError(null);
    try {
      downloadBlob(await exportOq(pkg, media), `${safeFileName(pkg.title)}.oq`);
    } catch (error) {
      setExportError(
        error instanceof ExportMediaError
          ? t("editor.exportMediaFailed", { name: error.fileName })
          : String(error),
      );
    }
  };

  const mediaBytes = useMemo(() => {
    let n = 0;
    for (const md5 of reachableMedia(pkg)) n += media.get(md5)?.bytes.byteLength ?? 0;
    return n;
  }, [pkg, media]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-text">
      {header ?? (
        <EditorHeader
          onPublish={() => setPublish(true)}
          onDetails={() => setDetails(true)}
          onExport={exportDraft}
          onSearch={() => setSearch(true)}
          report={report}
          mediaBytes={mediaBytes}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 overflow-y-auto border-r border-line px-3 py-5 lg:block">
          <Outline
            report={report}
            onAddRound={addRound}
            onDetails={() => setDetails(true)}
            onJumpTheme={jumpTheme}
          />
        </aside>

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-7">
            <SaveFailedBanner onExport={exportDraft} />
            {exportError && (
              <p role="alert" className="m-0 text-sm text-danger" data-testid="export-failed">
                {exportError}
              </p>
            )}
            {importWarnings.length > 0 && (
              <ImportWarnings warnings={importWarnings} onDismiss={dismissImportWarnings} />
            )}
            <RoundChips onAdd={readOnly ? undefined : addRound} />
            {round ? (
              <RoundBoard
                key={round.id}
                round={round}
                roundIndex={roundIndex}
                roundCount={pkg.rounds.length}
                report={report}
                actions={actions}
              />
            ) : (
              !readOnly && <EmptyPackage onAddRound={addRound} />
            )}
          </div>
        </main>

        {wide && selected && (
          <aside
            aria-label={t("editor.inspector.label")}
            className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-surface/60 p-5"
            data-testid="inspector"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-faint">
                {selected.round.name || "—"} › {selected.theme.name || "—"}
              </span>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={() => select(null)}
                className="inline-flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-2"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <QuestionPreview question={selected.question} final={selected.round.type === "final"} />
            {!readOnly && (
              <div className="mt-auto flex gap-2 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  icon={<EditIcon size={18} />}
                  onClick={() => edit(selected.question.id)}
                >
                  {t("editor.actions.edit")}
                </Button>
                <IconButton
                  label={t("editor.actions.move")}
                  onClick={() => actions.move(selected.question.id)}
                >
                  <MoveIcon size={18} />
                </IconButton>
                <IconButton
                  label={t("editor.actions.duplicate")}
                  onClick={() => actions.duplicate(selected.question.id)}
                >
                  <CopyIcon size={18} />
                </IconButton>
                <IconButton
                  label={t("editor.actions.delete")}
                  danger
                  onClick={() => actions.remove(selected.question.id)}
                >
                  <TrashIcon size={18} />
                </IconButton>
              </div>
            )}
          </aside>
        )}
      </div>

      {!readOnly && <StatusBar report={report} onReview={() => setPublish(true)} />}
      {!readOnly && <UndoToast />}

      <QuestionDialog />
      <MoveDialog target={moveTarget} onClose={() => setMoveTarget(null)} />
      <RoundPricesDialog roundId={pricesRound} onClose={() => setPricesRound(null)} />
      <PasteQuestionsDialog roundId={pasteRound} onClose={() => setPasteRound(null)} />
      <SearchDialog
        open={search}
        onClose={() => setSearch(false)}
        onOpen={(roundId, questionId) => {
          selectRound(roundId);
          edit(questionId);
        }}
      />
      <PackageDialog open={details} onClose={() => setDetails(false)} />
      <PublishDialog
        open={publish}
        onClose={() => setPublish(false)}
        report={report}
        onJump={jump}
      />
      <Dialog
        open={confirm != null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "round"
            ? t("editor.confirm.roundTitle")
            : t("editor.confirm.themeTitle")
        }
        closeLabel={t("common.close")}
      >
        {confirm && (
          <div className="flex flex-col gap-4 p-5">
            <p className="m-0 text-soft [overflow-wrap:anywhere]">
              {t(`editor.confirm.${confirm.kind}Body`, {
                name: confirm.name || "—",
                count: confirm.questions,
              })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                size="lg"
                data-testid="confirm-delete"
                onClick={() => {
                  if (confirm.kind === "theme")
                    apply((p) => ops.deleteTheme(p, confirm.id), { key: "themeDeleted" });
                  else apply((p) => ops.deleteRound(p, confirm.id), { key: "roundDeleted" });
                  setConfirm(null);
                }}
              >
                {t("editor.actions.delete")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setConfirm(null)}>
                {t("editor.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border disabled:cursor-not-allowed disabled:text-ghost",
        danger
          ? "border-danger/40 bg-danger-surface text-danger"
          : "border-line-strong text-text hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function EditorHeader({
  onPublish,
  onDetails,
  onExport,
  onSearch,
  report,
  mediaBytes,
}: {
  onPublish: () => void;
  onDetails: () => void;
  onExport: () => void;
  onSearch: () => void;
  report: ReturnType<typeof validate>;
  mediaBytes: number;
}) {
  const { t } = useTranslation();
  const title = useEditor((s) => s.pkg.title);
  const apply = useEditor((s) => s.apply);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const savedAt = useEditor((s) => s.savedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-5">
      <Link
        to="/packages/editor"
        aria-label={t("editor.backToDrafts")}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 font-medium text-muted no-underline hover:text-text"
      >
        <BackIcon size={18} />
        <span className="hidden sm:inline">{t("editor.drafts")}</span>
      </Link>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col">
        <InlineText
          label={t("editor.details.name")}
          value={title}
          onCommit={(v) => apply((p) => ({ ...p, title: v }), { key: "renamed" })}
          placeholder={t("editor.details.namePlaceholder")}
          className="font-display text-xl font-extrabold"
        />
        <button
          type="button"
          onClick={onDetails}
          className="self-start px-1.5 text-left text-xs text-faint hover:text-text"
          data-testid="save-status"
        >
          {savedAt
            ? t("editor.savedAt", { when: timeAgo(new Date(savedAt).toISOString()) })
            : t("editor.notSaved")}
          {mediaBytes > 0 && ` · ${formatBytes(mediaBytes)}`}
        </button>
      </div>
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <IconButton label={t("editor.undo")} onClick={undo} disabled={!canUndo}>
          <UndoIcon size={18} />
        </IconButton>
        <IconButton label={t("editor.redo")} onClick={redo} disabled={!canRedo}>
          <RedoIcon size={18} />
        </IconButton>
        <DensityToggle />
        <IconButton label={t("editor.tools.searchTitle")} onClick={onSearch}>
          <SearchIcon size={18} />
        </IconButton>
        <div className="flex flex-1 items-center justify-end gap-2 sm:ml-1.5">
          <Button
            icon={<DownloadIcon size={18} />}
            onClick={onExport}
            title={t("editor.exportHelp")}
            aria-label={t("editor.export")}
            className="px-3 md:px-4"
          >
            <span className="hidden md:inline">{t("editor.export")}</span>
          </Button>
          <Button
            variant="accent"
            icon={<UploadIcon size={18} />}
            onClick={onPublish}
            data-testid="publish"
          >
            {t("editor.publish.open")}
            {report.critical > 0 && (
              <span className="rounded-full bg-danger-strong px-1.5 text-xs font-bold text-on-primary">
                {report.critical}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Compact cards with hover previews, or preview cards with media and answers. */
export function DensityToggle() {
  const { t } = useTranslation();
  const density = useEditor((s) => s.density);
  const setDensity = useEditor((s) => s.setDensity);
  return (
    <div
      role="group"
      aria-label={t("editor.density.label")}
      className="flex rounded-[12px] border border-line-strong p-0.5 sm:ml-1"
    >
      <button
        type="button"
        aria-pressed={density === "compact"}
        title={t("editor.density.compact")}
        aria-label={t("editor.density.compact")}
        onClick={() => setDensity("compact")}
        className={cn(
          "hidden size-10 items-center justify-center rounded-[10px] sm:inline-flex",
          density === "compact" ? "bg-surface-3 text-text" : "text-muted",
        )}
      >
        <ListIcon size={18} />
      </button>
      <button
        type="button"
        aria-pressed={density === "cards"}
        title={t("editor.density.cards")}
        aria-label={t("editor.density.cards")}
        data-testid="density-cards"
        // On phones this is the only view button, so it toggles.
        onClick={() => setDensity(density === "cards" ? "compact" : "cards")}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-[10px]",
          density === "cards" ? "bg-surface-3 text-text" : "text-muted",
        )}
      >
        <CardsIcon size={18} />
      </button>
    </div>
  );
}

function RoundChips({ onAdd }: { onAdd?: () => void }) {
  const { t } = useTranslation();
  const rounds = useEditor((s) => s.pkg.rounds);
  const roundId = useEditor((s) => s.roundId);
  const selectRound = useEditor((s) => s.selectRound);
  return (
    <nav
      aria-label={t("editor.outline.rounds")}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
    >
      {rounds.map((r, i) => (
        <button
          key={r.id}
          type="button"
          aria-current={r.id === roundId ? "page" : undefined}
          onClick={() => selectRound(r.id)}
          className={cn(
            "flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold",
            r.id === roundId ? "bg-surface-3 text-text" : "border border-line-strong text-muted",
          )}
        >
          {i + 1} · {r.name || t("editor.outline.untitled")}
        </button>
      ))}
      {onAdd && (
        <button
          type="button"
          aria-label={t("editor.outline.addRound")}
          onClick={onAdd}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted"
        >
          <PlusIcon size={16} />
        </button>
      )}
    </nav>
  );
}

function EmptyPackage({ onAddRound }: { onAddRound: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-5 py-14 text-center">
      <p className="m-0 font-display text-2xl font-extrabold">{t("editor.empty.title")}</p>
      <p className="m-0 max-w-[48ch] text-muted">{t("editor.empty.help")}</p>
      <Button
        variant="accent"
        size="lg"
        icon={<PlusIcon size={18} />}
        onClick={onAddRound}
        data-testid="add-round"
      >
        {t("editor.outline.addRound")}
      </Button>
    </div>
  );
}

function StatusBar({
  report,
  onReview,
}: {
  report: ReturnType<typeof validate>;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const questions = useEditor((s) => countQuestions(s.pkg));
  const first = report.issues.find((i) => i.severity !== "info");
  return (
    <footer className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5 text-sm sm:px-5">
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          report.health === "broken"
            ? "bg-danger-strong"
            : report.health === "needsAttention"
              ? "bg-warning"
              : "bg-success",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-soft" data-testid="health">
        {report.health === "good"
          ? t("editor.status.good", { count: questions })
          : first
            ? `${t(`editor.health.${report.health}`, { count: report.critical })} · ${t(`editor.issues.${first.code}`, first.args)}`
            : ""}
      </span>
      {report.health !== "good" && (
        <button
          type="button"
          onClick={onReview}
          className="shrink-0 font-semibold text-info-soft hover:text-text"
        >
          {t("editor.status.review")}
        </button>
      )}
    </footer>
  );
}

function UndoToast() {
  const { t } = useTranslation();
  const change = useEditor((s) => s.lastChange);
  const undo = useEditor((s) => s.undo);
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!change) return;
    const id = window.setTimeout(() => setHidden(change.at), 6000);
    return () => window.clearTimeout(id);
  }, [change]);
  const quiet =
    !change || hidden === change.at || change.key === "renamed" || change.key === "questionSaved";
  if (quiet) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex justify-center px-4"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-md border border-line-strong bg-surface-2 py-2 pr-2 pl-4 shadow-xl oq-slide-up"
        role="status"
      >
        <CheckIcon size={16} />
        <span className="text-sm [overflow-wrap:anywhere]">
          {t(`editor.changes.${change.key}`, change.args)}
        </span>
        <Button size="sm" variant="ghost" onClick={undo} icon={<UndoIcon size={16} />}>
          {t("editor.undo")}
        </Button>
      </div>
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Autosave failed (device storage full, or the write was aborted): the edits
 * only live in this tab. Offers a retry and a file export so nothing is lost.
 */
function SaveFailedBanner({ onExport }: { onExport: () => void }) {
  const { t } = useTranslation();
  const saveError = useEditor((s) => s.saveError);
  const retrySave = useEditor((s) => s.retrySave);

  if (!saveError) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger-surface px-4 py-3"
      data-testid="save-failed"
    >
      <span className="min-w-0 flex-1 text-sm">{t("editor.saveFailed")}</span>
      <Button size="sm" onClick={retrySave}>
        {t("editor.saveRetry")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onExport}>
        {t("editor.export")}
      </Button>
    </div>
  );
}
