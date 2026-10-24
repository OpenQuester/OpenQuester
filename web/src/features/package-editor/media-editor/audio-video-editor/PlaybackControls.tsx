import { mediaControlStyles } from "../MediaControls";
import { useTranslation } from "react-i18next";
import type { AudioVideoEditorState } from "./useAudioVideoEditor";
import { Button } from "@/ui/Button";
import { PlayIcon, PauseIcon, TrimLeftIcon, TrimRightIcon } from "@/ui/icons";
import { formatTime } from "../mediaEdits";
import { HistoryButtons } from "../HistoryButtons";
export function PlaybackControls({ editor }: { editor: AudioVideoEditorState }) {
  const { t } = useTranslation();
  const {
    supported,
    leftTrim,
    rightTrim,
    error,
    update,
    valid,
    playing,
    togglePlayback,
    position,
    meta,
    history,
    undo,
  } = editor;
  if (!meta) return null;
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex shrink-0 items-center gap-1"
        role="group"
        aria-label={t("mediaEditor.playbackTools")}
      >
        <Button
          className={mediaControlStyles.iconButton}
          disabled={!supported || !leftTrim || error}
          aria-label={t("mediaEditor.trimLeft")}
          title={t("mediaEditor.trimLeft")}
          onClick={() => {
            if (leftTrim) update(leftTrim);
          }}
        >
          <TrimLeftIcon />
        </Button>
        <Button
          className={mediaControlStyles.iconButton}
          variant="accent"
          disabled={!valid || error}
          aria-label={t(playing ? "mediaEditor.pause" : "mediaEditor.play")}
          title={t(playing ? "mediaEditor.pause" : "mediaEditor.play")}
          aria-keyshortcuts="Space"
          onClick={togglePlayback}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          className={mediaControlStyles.iconButton}
          disabled={!supported || !rightTrim || error}
          aria-label={t("mediaEditor.trimRight")}
          title={t("mediaEditor.trimRight")}
          onClick={() => {
            if (rightTrim) update(rightTrim);
          }}
        >
          <TrimRightIcon />
        </Button>
      </div>
      <div
        className="min-w-0 flex-1 text-sm tabular-nums"
        role="timer"
        aria-live="off"
        aria-label={t("mediaEditor.position")}
      >
        <span className="block">{formatTime(position)}</span>
        <span className="block text-xs text-muted">/ {formatTime(meta.duration)}</span>
      </div>
      <HistoryButtons
        canUndo={!!history.past.length}
        canRedo={!!history.future.length}
        undo={() => undo()}
        redo={() => undo(true)}
      />
    </div>
  );
}
