import { useEffect, useRef, useState } from "react";
import { resumeAudioContext } from "@/lib/audioContext";
import { useMediaVolume } from "./useMediaVolume";

/** Own one media element's game-controlled playback and sound state. */
export function useQuestionMediaPlayback(
  playing: boolean,
  positionMs?: () => number,
  fallbackPositionMs: number | null = null,
  holdFrame = false,
  clockKey?: string | number | null,
) {
  const { volume } = useMediaVolume();
  const ref = useRef<HTMLMediaElement | null>(null);
  // Latest sync position, read when playback (re)starts.
  const positionRef = useRef(positionMs);
  useEffect(() => {
    positionRef.current = positionMs;
  });
  // Browsers block sound until the page has been tapped once. Then we play
  // muted, in sync with everyone, and offer one tap to turn the sound on.
  const [blocked, setBlocked] = useState(false);
  const hasPlayed = useRef(false);
  const restored = useRef(false);

  useEffect(() => {
    const el = ref.current;
    return () => el?.pause();
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    // Seek on late join/resume and when a completed video first mounts as a held frame.
    const seek = () => {
      const restoring = fallbackPositionMs != null && !restored.current;
      const position = positionRef.current?.() ?? (restoring ? fallbackPositionMs : null);
      if (position == null || !Number.isFinite(position)) return;
      const target = Math.max(0, position / 1000);
      const limit = Number.isFinite(el.duration)
        ? Math.max(0, el.duration - (el instanceof HTMLVideoElement ? 0.04 : 0))
        : target;
      const time = Math.min(target, limit);
      if (restoring || Math.abs(el.currentTime - time) > 0.12) el.currentTime = time;
      if (restoring) restored.current = true;
    };
    const sync = playing || !hasPlayed.current || clockKey != null;
    if (sync && (playing || holdFrame || positionRef.current)) {
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    }
    if (!playing) {
      el.pause();
      return () => el.removeEventListener("loadedmetadata", seek);
    }
    if (el instanceof HTMLAudioElement && el.ended) return;
    hasPlayed.current = true;
    const handlePlayError = (err: unknown) => {
      if (!alive) return;
      const name = (err as DOMException)?.name;
      if (name === "AbortError") {
        // The load interrupted play(): retry once the media can play.
        el.addEventListener("canplay", retry, { once: true });
        return;
      }
      if (name !== "NotAllowedError") return;
      el.muted = true;
      setBlocked(true);
      void el.play().catch(() => undefined);
    };
    const retry = () =>
      void el.play().catch((err: unknown) => {
        if ((err as DOMException)?.name !== "AbortError") handlePlayError(err);
      });
    void el.play().catch(handlePlayError);
    return () => {
      alive = false;
      el.removeEventListener("loadedmetadata", seek);
      el.removeEventListener("canplay", retry);
    };
  }, [playing, fallbackPositionMs, holdFrame, clockKey]);

  function enableSound() {
    const el = ref.current;
    if (!el) return;
    if (el instanceof HTMLAudioElement) resumeAudioContext();
    el.muted = false;
    setBlocked(false);
    if (playing && !el.ended) void el.play().catch(() => undefined);
  }

  return { ref, blocked, enableSound, volume };
}
