import { dialogStyles } from "@/ui/dialogStyles";
import { questionFormStyles } from "./questionFormStyles";
import * as RD from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { Button } from "@/ui/Button";
import { StagedMediaContext } from "../packageEditorStore";
import { MediaSessionContext } from "../media-editor/useStagedMedia";
import type * as ops from "../packageOperations";
import { QuestionPreview } from "../QuestionPreview";
import { QuestionContent } from "./QuestionContent";
import { QuestionHeader, QuestionFooter } from "./QuestionFormChrome";
import { useQuestionForm } from "./useQuestionForm";
import { useEffect, useRef, useState } from "react";
export function QuestionForm({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useQuestionForm(at, onClose);
  const { q, final, media, requestClose, save } = form;
  const [preview, setPreview] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
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
                requestClose();
              }}
              onKeyDown={(e) => {
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

                <QuestionFooter form={form} onClose={onClose} />
                <Dialog
                  open={preview}
                  onOpenChange={setPreview}
                  title={t("editor.form.preview")}
                  wide
                  closeLabel={t("common.close")}
                >
                  <div className="p-5" onKeyDown={(event) => event.stopPropagation()}>
                    <QuestionPreview question={q} final={final} />
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
