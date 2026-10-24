import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { MediaFile } from "@/features/upload/types";
import type { AudioVideoEdits } from "../mediaEdits";

export type AudioVideoMetadata = {
  duration: number;
  hasAudio: boolean;
  canVideo: boolean;
  canSound: boolean;
  decodeVideo: boolean;
  decodeSound: boolean;
};

/** Decode only the metadata and bounded waveform/thumbnail previews needed by the editor. */
export function useAudioVideoSource(
  file: MediaFile,
  mime: string,
  video: boolean,
  setEdits: Dispatch<SetStateAction<AudioVideoEdits | null>>,
) {
  const [meta, setMeta] = useState<AudioVideoMetadata | null>(null);
  const [error, setError] = useState(false);
  const [visualError, setVisualError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    let dispose = () => {};
    void (async () => {
      const [
        { Input, ALL_FORMATS, BlobSource, CanvasSink, AudioSampleSink },
        { pickVideoCodec, pickAudioCodec, canEncodeOpus },
      ] = await Promise.all([
        import("mediabunny"),
        import("@/features/upload/optimize/audioVideo"),
      ]);
      if (!alive) return;
      const input = new Input({
        source: new BlobSource(new Blob([file.bytes as BlobPart], { type: mime })),
        formats: ALL_FORMATS,
      });
      dispose = () => input.dispose();
      const v = await input.getPrimaryVideoTrack(),
        a = await input.getPrimaryAudioTrack();
      const duration = await input.computeDuration();
      if (!Number.isFinite(duration) || duration <= 0 || (video ? !v : !a))
        throw new Error("unsupported");
      const [canVideo, canSound, decodeVideo, decodeSound] = await Promise.all([
        video ? pickVideoCodec().then(Boolean) : true,
        video ? canEncodeOpus() : pickAudioCodec().then(Boolean),
        v ? v.canDecode() : true,
        a ? a.canDecode() : true,
      ]);
      if (!alive) return;
      setMeta({ duration, hasAudio: !!a, canVideo, canSound, decodeVideo, decodeSound });
      setEdits(
        (old) =>
          old ?? {
            kind: video ? "video" : "audio",
            start: 0,
            end: duration,
            mute: false,
            fadeIn: 0,
            fadeOut: 0,
          },
      );
      try {
        if (video && v && decodeVideo) {
          const sink = new CanvasSink(v, { width: 160 });
          const result: string[] = [];
          for (let i = 0; i < 8 && alive; i++) {
            const frame = await sink.getCanvas((duration * i) / 8);
            if (frame && alive) {
              const canvas = document.createElement("canvas");
              canvas.width = frame.canvas.width;
              canvas.height = frame.canvas.height;
              canvas.getContext("2d")!.drawImage(frame.canvas, 0, 0);
              result.push(canvas.toDataURL("image/jpeg", 0.6));
              setFrames([...result]);
            }
          }
        } else if (a && decodeSound) {
          // Stream samples into a fixed-size envelope; never keep the entire decoded clip in memory.
          const bins = new Array<number>(512).fill(0);
          const sink = new AudioSampleSink(a);
          let count = 0;
          for await (const sample of sink.samples()) {
            try {
              if (!alive) break;
              const buffer = sample.toAudioBuffer();
              for (let c = 0; c < buffer.numberOfChannels; c++) {
                const data = buffer.getChannelData(c);
                for (let i = 0; i < data.length; i += 8) {
                  const at = Math.floor(
                    ((sample.timestamp + i / buffer.sampleRate) / duration) * bins.length,
                  );
                  if (at >= 0 && at < bins.length)
                    bins[at] = Math.max(bins[at]!, Math.abs(data[i]!));
                }
              }
              if (++count % 32 === 0) {
                setPeaks([...bins]);
                await new Promise((r) => setTimeout(r, 0));
              }
            } finally {
              sample.close();
            }
          }
          if (alive) setPeaks(bins);
        }
      } catch {
        if (alive) setVisualError(true);
      } finally {
        dispose();
      }
    })().catch(() => {
      dispose();
      if (alive) setError(true);
    });
    return () => {
      alive = false;
      dispose();
    };
  }, [file, mime, video, attempt, setEdits]);

  return { meta, error, setError, visualError, setAttempt, peaks, frames };
}
