import { mediaEditorStyles } from "../mediaEditorStyles";
import { useTranslation } from "react-i18next";
import type { AudioVideoEditorState } from "./useAudioVideoEditor";
import { mediaUrl } from "../../packageMedia";
import { Button } from "@/ui/Button";
import { VolumeIcon, VolumeOffIcon } from "@/ui/icons";
export function AudioVideoPreview({ editor }: { editor: AudioVideoEditorState }) {
  const { t } = useTranslation();
  const { file, video, meta, edits, playerRef, events, update } = editor;

  return video ? (
    <div className={mediaEditorStyles.videoViewport}>
      <video
        ref={(el) => {
          playerRef.current = el;
        }}
        src={mediaUrl(file)}
        preload="metadata"
        playsInline
        className={mediaEditorStyles.video}
        {...events}
      />
      {meta && edits && (
        <Button
          className={mediaEditorStyles.muteButton}
          disabled={!meta.hasAudio}
          aria-label={t(meta.hasAudio ? "mediaEditor.removeAudio" : "mediaEditor.noAudio")}
          aria-pressed={edits.mute || !meta.hasAudio}
          title={t(
            !meta.hasAudio
              ? "mediaEditor.noAudio"
              : edits.mute
                ? "mediaEditor.restoreAudio"
                : "mediaEditor.removeAudio",
          )}
          onClick={() => update({ mute: !edits.mute })}
        >
          {edits.mute || !meta.hasAudio ? <VolumeOffIcon /> : <VolumeIcon />}
        </Button>
      )}
    </div>
  ) : (
    <audio
      ref={(el) => {
        playerRef.current = el;
      }}
      src={mediaUrl(file)}
      preload="metadata"
      {...events}
    />
  );
}
