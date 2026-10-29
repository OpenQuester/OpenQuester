import { dialogStyles } from "@/ui/dialogStyles";
import { questionFormStyles } from "./questionFormStyles";
import * as RD from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { Button } from "@/ui/Button";
import { StagedMediaContext } from "../packageEditorStore";
import { MediaSessionContext } from "../media-editor/useStagedMedia";
import type * as ops from "../packageOperations";
import { QuestionContent } from "./QuestionContent";
import { QuestionHeader, QuestionFooter } from "./QuestionFormChrome";
import { useQuestionForm } from "./useQuestionForm";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePackageEditor } from "../packageEditorStore";
import { Spinner } from "@/ui/Spinner";

const QuestionPlaytest = lazy(() =>
  import("../playtest/QuestionPlaytest").then((module) => ({ default: module.QuestionPlaytest })),
);
export function QuestionForm({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useQuestionForm(at, onClose);
  const { q, final, media, requestClose, save } = form;
  const [preview, setPreview] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const previewFocus = useRef<string | null>(null);
  const storedMedia = usePackageEditor((s) => s.media);
  const previewMedia = useMemo(
    () => new Map([...storedMedia, ...media.pending]),
    [storedMedia, media.pending],
  );
  useEffect(() => {
    if (media.active || preview)
      fields.current
        ?.querySelectorAll<HTMLMediaElement>("audio, video")
        .forEach((el) => el.pause());
  }, [media.active, preview]);
  return (
    <StagedMediaContext.Provider value={media.pending}>
      <MediaSessionContext.Provider value={media.open}>
        <RD.Root open onOpenChange={(o) => !o && requestClose()}>
          <RD.Portal>
            <RD.Overlay className={dialogStyles.overlay} />
            <RD.Content
              data-testid="question-dialog"
              onEscapeKeyDown={(e) => {
                e.preventDefault();
                if (fields.current?.querySelector("[data-timeline-dragging]")) return;
                requestClose();
              }}
              onKeyDown={(e) => {
                const target = e.target as HTMLElement;
                if (
                  !preview &&
                  !media.active &&
                  !form.confirmClose &&
                  form.hasMediaUndo &&
                  !e.defaultPrevented &&
                  !e.repeat &&
                  !e.nativeEvent.isComposing &&
                  !e.altKey &&
                  !e.shiftKey &&
                  e.ctrlKey !== e.metaKey &&
                  e.key.toLowerCase() === "z" &&
                  e.currentTarget.contains(target) &&
                  !target.closest(
                    "input, textarea, select, [contenteditable]:not([contenteditable=false])",
                  )
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (target === undoButton.current) undoButton.current.click();
                  else form.undoMedia();
                }
                if (!preview && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
              className={questionFormStyles.dialog}
            >
              {media.node}
              <div ref={fields} className={media.active ? "hidden" : "contents"}>
                <QuestionHeader at={at} form={form} />

                <div className={questionFormStyles.body} data-testid="question-form-body">
                  <div className={questionFormStyles.content}>
                    <Button variant="primary" onClick={() => setPreview(true)}>
                      {t("editor.form.preview")}
                    </Button>
                    <QuestionContent form={form} />
                  </div>
                </div>

                <QuestionFooter form={form} onClose={onClose} undoButton={undoButton} />
                <Dialog
                  open={preview}
                  onOpenChange={setPreview}
                  title={t("editor.playtest.title")}
                  description={t("editor.playtest.description")}
                  wide
                  fullScreen
                  restoreFocus={() => {
                    const selector = previewFocus.current;
                    previewFocus.current = null;
                    if (!selector) return null;
                    return (
                      fields.current?.querySelector<HTMLElement>(selector) ??
                      fields.current?.querySelector<HTMLElement>("#qf-answer-type") ??
                      fields.current?.querySelector<HTMLElement>("#qf-text") ??
                      null
                    );
                  }}
                  closeLabel={t("common.close")}
                >
                  <div
                    className="flex min-h-full flex-col"
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {preview && (
                      <Suspense
                        fallback={
                          <div className="p-5">
                            <Spinner label={t("editor.playtest.loading")} />
                          </div>
                        }
                      >
                        <QuestionPlaytest
                          question={q}
                          final={final}
                          themeName={at.theme.name}
                          media={previewMedia}
                          canSave={form.canSave}
                          onFix={(selector) => {
                            previewFocus.current = selector;
                            setPreview(false);
                          }}
                        />
                      </Suspense>
                    )}
                  </div>
                </Dialog>
              </div>
            </RD.Content>
          </RD.Portal>
        </RD.Root>
      </MediaSessionContext.Provider>
    </StagedMediaContext.Provider>
  );
}
