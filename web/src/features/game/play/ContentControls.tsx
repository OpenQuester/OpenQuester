import type { ReactNode } from "react";
import { MediaVolume } from "./media/MediaVolume";

/** The same control row serves regular, answer, final and legacy presentations. */
export function ContentControls({ volume, children }: { volume: boolean; children?: ReactNode }) {
  return (
    <div className="content-controls" data-testid="content-controls">
      {volume && <MediaVolume />}
      {children}
    </div>
  );
}
