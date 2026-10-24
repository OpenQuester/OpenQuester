import { dialogStyles } from "@/ui/dialogStyles";
import { questionFormStyles } from "./questionFormStyles";
import * as RD from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { StagedMediaContext } from "../packageEditorStore";
import { MediaSessionContext } from "../media-editor/useStagedMedia";
import type * as ops from "../packageOperations";
import { QuestionPreview } from "../QuestionPreview";
import { QuestionContent } from "./QuestionContent";
import { QuestionHeader, QuestionFooter } from "./QuestionFormChrome";
import { QuestionTypeSettings } from "./QuestionTypeSettings";
import { useQuestionForm } from "./useQuestionForm";
import { useEffect, useRef } from "react";
export function QuestionForm({ at, onClose }: { at: ops.QuestionPath; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useQuestionForm(at, onClose);
  const { q, set, final, media, requestClose, save } = form;
  const fields = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (media.active)
      fields.current
        ?.querySelectorAll<HTMLMediaElement>("audio, video")
        .forEach((el) => el.pause());
  }, [media.active]);
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
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
              className={questionFormStyles.dialog}
            >
              {media.node}
              <div ref={fields} className={media.active ? "hidden" : "contents"}>
                <QuestionHeader at={at} form={form} />

                <div className={questionFormStyles.body}>
                  <div className={questionFormStyles.content}>
                    <QuestionContent form={form} />
                  </div>

                  <aside className={questionFormStyles.settings}>
                    <QuestionTypeSettings q={q} set={set} final={final} />
                    <div className={questionFormStyles.preview}>
                      <div className="h-px bg-line" />
                      <span className={questionFormStyles.previewLabel}>
                        {t("editor.form.preview")}
                      </span>
                      <QuestionPreview question={q} final={final} compact />
                    </div>
                  </aside>
                </div>

                <QuestionFooter form={form} onClose={onClose} />
              </div>
            </RD.Content>
          </RD.Portal>
        </RD.Root>
      </MediaSessionContext.Provider>
    </StagedMediaContext.Provider>
  );
}
