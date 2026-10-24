import { mediaEditorStyles } from "./mediaEditorStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { MediaToolProps } from "./mediaEditorTypes";
import { useAudioVideoEditor } from "./audio-video-editor/useAudioVideoEditor";
import { AudioVideoPreview } from "./audio-video-editor/AudioVideoPreview";
import { MediaTimeline } from "./audio-video-editor/MediaTimeline";
import { PlaybackControls } from "./audio-video-editor/PlaybackControls";
import { AudioVideoSettings } from "./audio-video-editor/AudioVideoSettings";

export default function AudioVideoEditor(props: MediaToolProps) {
  const { t } = useTranslation();
  const editor = useAudioVideoEditor(props);
  return (
    <div className={mediaEditorStyles.audioVideoWorkspace} onKeyDown={editor.onKeyDown}>
      <div
        className={cn(
          mediaEditorStyles.audioVideoPreviewColumn,
          !editor.video && "lg:justify-center",
        )}
      >
        <AudioVideoPreview editor={editor} />
        {editor.meta && editor.edits && (
          <>
            <MediaTimeline editor={editor} />
            <PlaybackControls editor={editor} />
            <p className="m-0 text-sm text-muted">{t("mediaEditor.timelineHelp")}</p>
          </>
        )}
      </div>
      {editor.meta && editor.edits ? (
        <AudioVideoSettings editor={editor} />
      ) : (
        <p role="status">{t("mediaEditor.loading")}</p>
      )}
    </div>
  );
}
