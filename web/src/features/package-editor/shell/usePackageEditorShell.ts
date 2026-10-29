import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { downloadBlob, ExportMediaError, exportOq, safeFileName } from "../packageMedia";
import { newRound, reachableMedia } from "../packageDraft";
import type { MoveTarget } from "../MovePackageItemDialog";
import * as ops from "../packageOperations";
import type { BoardActions } from "../RoundBoard";
import { usePackageEditor, usePackageEditorStore } from "../packageEditorStore";
import { validatePackage, type PackageValidationIssue } from "../validatePackage";

type Confirm = { kind: "theme" | "round"; id: string; name: string; questions: number };

/** Coordinates navigation, package actions and dialogs for one editor store. */
export function usePackageEditorShell(inspectorFits = true) {
  const { t } = useTranslation();
  const store = usePackageEditorStore();
  const readOnly = usePackageEditor((s) => s.readOnly);
  const pkg = usePackageEditor((s) => s.pkg);
  const media = usePackageEditor((s) => s.media);
  const roundId = usePackageEditor((s) => s.roundId);
  const selectedId = usePackageEditor((s) => s.selectedId);
  const apply = usePackageEditor((s) => s.apply);
  const select = usePackageEditor((s) => s.select);
  const selectRound = usePackageEditor((s) => s.selectRound);
  const edit = usePackageEditor((s) => s.edit);
  const wideScreen = useMediaQuery("(min-width: 1280px)");
  const wide = wideScreen && inspectorFits;

  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [pricesRound, setPricesRound] = useState<string | null>(null);
  const [pasteRound, setPasteRound] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [details, setDetails] = useState(false);
  const [publish, setPublish] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const report = useMemo(() => validatePackage(pkg, (md5) => media.has(md5)), [pkg, media]);
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
  const jumpToIssue = (issue: PackageValidationIssue) => {
    const tg = issue.target;
    if (tg.kind === "package") setDetails(true);
    if (tg.kind === "round") selectRound(tg.id);
    if (tg.kind === "theme") jumpTheme(tg.roundId, tg.id);
    if (tg.kind === "question") {
      selectRound(tg.roundId);
      edit(tg.id);
    }
  };

  const importWarnings = usePackageEditor((s) => s.importWarnings);
  const [importReportHidden, setImportReportHidden] = useState(false);
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

  const confirmRemoval = () => {
    if (!confirm) return;
    if (confirm.kind === "theme")
      apply((p) => ops.deleteTheme(p, confirm.id), { key: "themeDeleted" });
    else apply((p) => ops.deleteRound(p, confirm.id), { key: "roundDeleted" });
    setConfirm(null);
  };
  return {
    readOnly,
    pkg,
    round,
    roundIndex,
    selected,
    wide,
    report,
    actions,
    addRound,
    jumpTheme,
    exportDraft,
    exportError,
    mediaBytes,
    importWarnings,
    importReportHidden,
    setImportReportHidden,
    setDetails,
    setSearch,
    setPublish,
    dialogs: {
      moveTarget,
      setMoveTarget,
      pricesRound,
      setPricesRound,
      pasteRound,
      setPasteRound,
      search,
      setSearch,
      details,
      setDetails,
      publish,
      setPublish,
      confirm,
      setConfirm,
      selectRound,
      edit,
      report,
      jumpToIssue,
      confirmRemoval,
    },
  };
}
