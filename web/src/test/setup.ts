import "@testing-library/jest-dom/vitest";
import "@/i18n/index";

import { beforeEach, vi } from "vitest";

// jsdom does not implement these browser APIs. Native browser tests exercise
// real animation progress, reduced motion and media playback.
beforeEach(() => {
  if (typeof window === "undefined") return;
  if (!window.matchMedia)
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  if (!Element.prototype.animate)
    Element.prototype.animate = vi.fn(() => ({
      currentTime: 0,
      pause: vi.fn(),
      cancel: vi.fn(),
    })) as unknown as typeof Element.prototype.animate;
});
