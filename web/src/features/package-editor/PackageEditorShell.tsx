import { packageEditorShellStyles } from "./shell/packageEditorShellStyles";
import { ImportWarnings } from "@/features/upload/ImportWarnings";
import { PackageOutline } from "./PackageOutline";
import { RoundBoard } from "./RoundBoard";
import { PackageEditorDialogs } from "./shell/PackageEditorDialogs";
import { PackageEditorHeader } from "./shell/PackageEditorHeader";
import { PackageEditorInspector } from "./shell/PackageEditorInspector";
import { EmptyPackageNotice, PackageRoundChips } from "./shell/PackageEditorNavigation";
import {
  DraftSaveFailure,
  PackageValidationStatus,
  PackageUndoToast,
} from "./shell/PackageEditorStatus";
import { usePackageEditorShell } from "./shell/usePackageEditorShell";
import { useInspectorResize } from "./shell/useInspectorResize";
import { useDragAutoScroll } from "./packageDragDrop";

/** `header` replaces the editing header, e.g. for a read-only preview. */
export function PackageEditorShell({ header }: { header?: React.ReactNode } = {}) {
  useDragAutoScroll();
  const { containerRef, outlineRef, fits, ...resize } = useInspectorResize();
  const shell = usePackageEditorShell(fits);
  const {
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
  } = shell;
  return (
    <div className={packageEditorShellStyles.root}>
      {header ?? (
        <PackageEditorHeader
          onPublish={() => setPublish(true)}
          onDetails={() => setDetails(true)}
          onExport={exportDraft}
          onSearch={() => setSearch(true)}
          report={report}
          mediaBytes={mediaBytes}
        />
      )}

      <div ref={containerRef} className="flex min-h-0 flex-1">
        <aside ref={outlineRef} className={packageEditorShellStyles.outline} data-editor-scroll>
          <PackageOutline
            report={report}
            onAddRound={addRound}
            onDetails={() => setDetails(true)}
            onJumpTheme={jumpTheme}
          />
        </aside>

        <main id="main" className="min-w-0 flex-1 overflow-y-auto" data-editor-scroll>
          <div className={packageEditorShellStyles.workspace}>
            <DraftSaveFailure onExport={exportDraft} />
            {exportError && (
              <p role="alert" className="m-0 text-sm text-danger" data-testid="export-failed">
                {exportError}
              </p>
            )}
            {importWarnings.length > 0 && !importReportHidden && (
              <ImportWarnings
                warnings={importWarnings}
                onDismiss={() => setImportReportHidden(true)}
              />
            )}
            <PackageRoundChips onAdd={readOnly ? undefined : addRound} />
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
              !readOnly && <EmptyPackageNotice onAddRound={addRound} />
            )}
          </div>
        </main>

        {wide && selected && (
          <PackageEditorInspector selected={selected} actions={actions} resize={resize} />
        )}
      </div>

      {!readOnly && <PackageValidationStatus report={report} onReview={() => setPublish(true)} />}
      {!readOnly && <PackageUndoToast />}

      <PackageEditorDialogs {...shell.dialogs} />
    </div>
  );
}
