import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/features/settings/settingsStore";

/** Own one media element's game-controlled playback and local replay/sound state. */
export function useQuestionMediaPlayback(playing: boolean, positionMs?: () => number) {
  const volume = useSettings((s) => s.volume);
  const update = useSettings((s) => s.update);
  const ref = useRef<HTMLMediaElement | null>(null);
  // Latest sync position, read when playback (re)starts.
  const positionRef = useRef(positionMs);
  useEffect(() => {
    positionRef.current = positionMs;
  });
  // Browsers block sound until the page has been tapped once. Then we play
  // muted, in sync with everyone, and offer one tap to turn the sound on.
  const [blocked, setBlocked] = useState(false);
  // Played to the end: offer to hear (or see) it again, on this device only.
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    return () => el?.pause();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    if (!playing) {
      el.pause();
      return;
    }
    let alive = true;
    // Joined late or resumed: jump to where everyone else is.
    const target = positionRef.current ? positionRef.current() / 1000 : null;
    const seek = () => {
      if (target == null || !Number.isFinite(target)) return;
      if (Number.isFinite(el.duration) && target >= el.duration) return;
      el.currentTime = target;
    };
    if (target != null && Number.isFinite(target) && Math.abs(el.currentTime - target) > 1.5) {
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    }
    el.play().catch((err: unknown) => {
      if (!alive || (err as DOMException)?.name !== "NotAllowedError") return;
      el.muted = true;
      setBlocked(true);
      void el.play().catch(() => undefined);
    });
    return () => {
      alive = false;
      el.removeEventListener("loadedmetadata", seek);
    };
  }, [playing, volume]);

  function replay() {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    setEnded(false);
    void el.play().catch(() => undefined);
  }

  function enableSound() {
    const el = ref.current;
    if (!el) return;
    el.muted = false;
    setBlocked(false);
    if (playing) void el.play().catch(() => undefined);
  }

  return { volume, update, ref, blocked, ended, setEnded, replay, enableSound };
}
