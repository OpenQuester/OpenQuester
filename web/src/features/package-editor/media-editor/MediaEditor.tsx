import { mediaEditorStyles } from "./mediaEditorStyles";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { MediaEditorProps } from "./mediaEditorTypes";
import { useMediaSession } from "./useMediaSession";
import { MediaEditorFooter } from "./MediaEditorFooter";
const ImageEditor = lazy(() => import("./ImageEditor"));
const AudioVideoEditor = lazy(() => import("./AudioVideoEditor"));
export function MediaEditor(props: MediaEditorProps) {
  const { t } = useTranslation();
  const { source, title, index, total } = props;
  const session = useMediaSession(props);
  const { loaded, controlRef, statusChanged, busy } = session;
  const loading = (
    <p role="status" className="p-6 text-muted">
      {t("mediaEditor.loading")}
    </p>
  );
  return (
    <section
      className={mediaEditorStyles.editor}
      data-testid="media-editor"
      onKeyDown={session.onKeyDown}
    >
      <header className={mediaEditorStyles.header}>
        <div className="min-w-0 flex-1">
          <h2
            tabIndex={-1}
            ref={(el) => {
              if (el && !el.dataset.focused) {
                el.dataset.focused = "true";
                el.focus();
              }
            }}
            className={mediaEditorStyles.title}
          >
            {t("mediaEditor.title")}
          </h2>
          <p className="m-0 truncate text-sm text-muted">
            {title} · {source instanceof File ? source.name : (source.displayName ?? source.name)}
          </p>
        </div>
        {total > 1 && (
          <span className="text-sm text-muted">
            {t("mediaEditor.queue", { index: index + 1, total })}
          </span>
        )}
      </header>
      <div className={mediaEditorStyles.body} inert={busy || undefined}>
        {!loaded ? (
          loading
        ) : (
          <Suspense fallback={loading}>
            {loaded.file.type === "image" ? (
              <ImageEditor {...loaded} controlRef={controlRef} onStatus={statusChanged} />
            ) : (
              <AudioVideoEditor {...loaded} controlRef={controlRef} onStatus={statusChanged} />
            )}
          </Suspense>
        )}
      </div>
      <MediaEditorFooter
        session={session}
        index={index}
        total={total}
        onClose={props.onClose}
        onSkip={props.onSkip}
      />
    </section>
  );
}
