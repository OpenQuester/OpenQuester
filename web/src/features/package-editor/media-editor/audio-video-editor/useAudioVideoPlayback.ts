import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { fadeGain, type AudioVideoEdits } from "../mediaEdits";
import type { AudioVideoMetadata } from "./useAudioVideoSource";

/** Own the media element, selection clock and Web Audio envelope as one playback lifecycle. */
export function useAudioVideoPlayback({
  edits,
  meta,
  valid,
  video,
  setError,
}: {
  edits: AudioVideoEdits | null;
  meta: AudioVideoMetadata | null;
  valid: boolean;
  video: boolean;
  setError: Dispatch<SetStateAction<boolean>>;
}) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const graph = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const syncGain = useCallback(() => {
    const g = graph.current,
      el = playerRef.current;
    if (!g || !el || !edits || !valid) return;
    const duration = edits.end - edits.start;
    const current = el.currentTime - edits.start;
    const now = g.context.currentTime;
    g.gain.gain.cancelScheduledValues(now);
    g.gain.gain.setValueAtTime(fadeGain(current, duration, edits.fadeIn, edits.fadeOut), now);
    if (el.paused) return;
    for (const at of [...new Set([edits.fadeIn, duration - edits.fadeOut, duration])].sort(
      (a, b) => a - b,
    )) {
      if (at > current)
        g.gain.gain.linearRampToValueAtTime(
          fadeGain(at, duration, edits.fadeIn, edits.fadeOut),
          now + (at - current) / el.playbackRate,
        );
    }
  }, [edits, valid]);
  useEffect(() => {
    const el = playerRef.current;
    if (!el || !edits) return;
    if (!valid) {
      el.pause();
      return;
    }
    el.muted = edits.mute;
    if (!el.paused && (el.currentTime < edits.start || el.currentTime >= edits.end)) el.pause();
    syncGain();
  }, [edits, syncGain, valid]);
  useEffect(() => {
    if (!playing || !edits || !valid) return;
    let frame: number;
    const tick = () => {
      const el = playerRef.current;
      if (!el) return;
      if (!el.paused && el.currentTime >= edits.end) {
        el.pause();
        el.currentTime = edits.end;
      }
      setPosition(el.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, edits, valid]);
  useEffect(
    () => () => {
      playerRef.current?.pause();
      void graph.current?.context.close();
    },
    [],
  );

  const play = async () => {
    const el = playerRef.current;
    if (!el || !edits) return;
    try {
      if (!video && !graph.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        context.createMediaElementSource(el).connect(gain).connect(context.destination);
        graph.current = { context, gain };
      }
      await graph.current?.context.resume();
      if (el.currentTime < edits.start || el.currentTime >= edits.end) el.currentTime = edits.start;
      await el.play();
      syncGain();
    } catch {
      setError(true);
    }
  };
  const events = {
    onTimeUpdate: () => {
      const el = playerRef.current;
      if (!el || !edits) return;
      if (!el.paused && el.currentTime >= edits.end) {
        el.pause();
        el.currentTime = edits.end;
      }
      setPosition(el.currentTime);
    },
    onPlay: () => {
      setPlaying(true);
      syncGain();
    },
    onPause: () => {
      setPlaying(false);
      syncGain();
    },
    onSeeked: () => {
      if (playerRef.current) setPosition(playerRef.current.currentTime);
      syncGain();
    },
    onRateChange: syncGain,
    onError: () => setError(true),
  };
  const seek = (at: number) => {
    const el = playerRef.current;
    if (!el || !meta || !Number.isFinite(at)) return;
    el.pause();
    const next =
      at >= meta.duration
        ? meta.duration
        : Math.max(0, Math.min(meta.duration, Math.round(at * 100) / 100));
    el.currentTime = next;
    setPosition(next);
  };
  const togglePlayback = () => (playing ? playerRef.current?.pause() : void play());
  return { playerRef, position, playing, events, seek, togglePlayback };
}
