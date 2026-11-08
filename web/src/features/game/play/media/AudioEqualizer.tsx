import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { useSettings } from "@/features/settings/settingsStore";
import { getAudioContext, watchAudioContext } from "@/lib/audioContext";
import { BAND_BASELINE, BAND_COUNT, FFT_SIZE, bandLevel, spectrumBands } from "./audioSpectrum";

const graphs = new WeakMap<HTMLMediaElement, ReturnType<typeof createGraph>>();
const motionQuery = "(prefers-reduced-motion: reduce)";
const bars = Array.from({ length: BAND_COUNT }, (_, i) => (
  <span
    key={i}
    className="h-full min-w-px flex-1 origin-bottom rounded-t-xs bg-current [transform:scaleY(.04)]"
  />
));

function createGraph(context: AudioContext, media: HTMLMediaElement) {
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.45;
  analyser.minDecibels = -85;
  analyser.maxDecibels = -30;
  const source = context.createMediaElementSource(media);
  const graph = {
    source,
    analyser,
    frequencies: new Uint8Array(analyser.frequencyBinCount),
    bands: spectrumBands(context.sampleRate),
  };
  graphs.set(media, graph);
  connectGraph(graph);
  return graph;
}

function connectGraph({ source, analyser }: ReturnType<typeof createGraph>) {
  // One audible route. The analyser's output is left disconnected.
  source.connect(source.context.destination);
  source.connect(analyser);
}

export function AudioEqualizer({
  mediaRef,
  active,
  enabled,
  onUseNative,
}: {
  mediaRef: RefObject<HTMLMediaElement | null>;
  active: boolean;
  enabled: boolean;
  onUseNative: (positionMs: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const switchToNative = useEffectEvent(onUseNative);

  useEffect(() => {
    const media = mediaRef.current;
    const view = container.current;
    if (!media || !view || !enabled) return;
    const spans = view.querySelectorAll("span");
    const motion = window.matchMedia?.(motionQuery);
    let frame: number | undefined;
    let lastFrame = -Infinity;
    let sampling: ReturnType<typeof createGraph> | undefined;
    const eligible = () =>
      active &&
      !reduceMotion &&
      !motion?.matches &&
      !document.hidden &&
      !media.paused &&
      !media.ended &&
      !media.muted &&
      media.volume > 0 &&
      !media.error &&
      media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;

    function stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      if (!sampling) return;
      sampling = undefined;
      spans.forEach((bar) => {
        bar.style.transform = `scaleY(${BAND_BASELINE})`;
      });
    }

    function draw(time: number) {
      if (!sampling || !eligible() || sampling.source.context.state !== "running") {
        stop();
        return;
      }
      if (time - lastFrame >= 1000 / 30) {
        lastFrame = time;
        const { analyser, frequencies, bands } = sampling;
        analyser.getByteFrequencyData(frequencies);
        spans.forEach((bar, i) => {
          bar.style.transform = `scaleY(${bandLevel(frequencies, bands[i]!)})`;
        });
      }
      frame = requestAnimationFrame(draw);
    }

    const sync = () => {
      const context = getAudioContext();
      const graph = graphs.get(media);
      if (!context || context.state !== "running" || !eligible()) {
        stop();
        // Once redirected into Web Audio, an interrupted context needs a fresh native element.
        if (graph && context?.state !== "running" && active && !document.hidden) {
          switchToNative(media.currentTime * 1000);
        }
        return;
      }
      if (sampling) return;
      try {
        sampling = graph ?? createGraph(context, media);
        frame = requestAnimationFrame(draw);
      } catch {
        stop();
      }
    };

    const unwatch = watchAudioContext(sync);
    document.addEventListener("visibilitychange", sync);
    motion?.addEventListener("change", sync);
    media.addEventListener("volumechange", sync);
    media.addEventListener("playing", sync);
    media.addEventListener("waiting", stop);
    media.addEventListener("pause", stop);
    media.addEventListener("ended", stop);
    media.addEventListener("error", stop);
    sync();
    return () => {
      stop();
      unwatch();
      document.removeEventListener("visibilitychange", sync);
      motion?.removeEventListener("change", sync);
      media.removeEventListener("volumechange", sync);
      media.removeEventListener("playing", sync);
      media.removeEventListener("waiting", stop);
      media.removeEventListener("pause", stop);
      media.removeEventListener("ended", stop);
      media.removeEventListener("error", stop);
    };
  }, [mediaRef, active, enabled, reduceMotion]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !enabled) return;
    // Effect replay (StrictMode) can reconnect a node, but cannot create it twice.
    const graph = graphs.get(media);
    if (graph) connectGraph(graph);
    return () => graphs.get(media)?.source.disconnect();
  }, [mediaRef, enabled]);

  return (
    <div
      ref={container}
      className="audio-spectrum pointer-events-none absolute inset-x-2.5 bottom-0 flex h-6 gap-0.5 text-accent opacity-55 sm:inset-x-3.5 sm:gap-[3px]"
      aria-hidden="true"
    >
      {bars}
    </div>
  );
}
