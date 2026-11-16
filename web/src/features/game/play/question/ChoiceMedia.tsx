import type { PackageFile } from "@/game/protocol";
import { mapUrl } from "@/lib/urlMappings";
import { EditorMediaPlayer } from "@/features/package-editor/EditorMediaPlayer";

/** Local option playback uses the existing seekable media controls; it never submits. */
export function ChoiceMedia({
  file,
  label,
  paused = false,
}: {
  file: PackageFile;
  label: string;
  paused?: boolean;
}) {
  if (!file.link) return null;
  return file.type === "image" ? (
    <img
      src={mapUrl(file.link)}
      alt={label}
      className="max-h-64 w-full rounded-md object-contain"
    />
  ) : (
    <EditorMediaPlayer
      key={file.link}
      src={mapUrl(file.link)}
      type={file.type}
      suspended={paused}
      onDuration={() => {}}
    />
  );
}
