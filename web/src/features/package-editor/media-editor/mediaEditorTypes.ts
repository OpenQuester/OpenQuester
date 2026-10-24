import type { RefObject } from "react";
import type { MediaFile } from "@/features/upload/types";
export interface MediaEditResult {
  file: MediaFile;
  source: MediaFile;
  geometryChanged: boolean;
}
export interface MediaEditStatus {
  ready: boolean;
  dirty: boolean;
  error?: string;
}
export interface MediaEditControl {
  retry?: () => void;
  undo?: (redo: boolean) => void;
  shortcut?: (key: string) => boolean;
  save: (
    signal: AbortSignal,
    progress: (ratio: number) => void,
  ) => Promise<{ file: MediaFile; geometryChanged: boolean }>;
}
export interface MediaToolProps {
  file: MediaFile;
  mime: string;
  controlRef: RefObject<MediaEditControl | null>;
  onStatus: (status: MediaEditStatus) => void;
}

export interface MediaEditorProps {
  source: File | MediaFile;
  title: string;
  index: number;
  total: number;
  onSave: (result: MediaEditResult) => void;
  onClose: () => void;
  onSkip: () => void;
  onRemaining: (signal: AbortSignal) => Promise<void>;
  closeRef: RefObject<(() => void) | null>;
}
