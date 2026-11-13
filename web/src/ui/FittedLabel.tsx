import { useLayoutEffect, useRef } from "react";

/** Keep a compact action label on one line at its normal size whenever it fits. */
export function FittedLabel({ children }: { children: string }) {
  const label = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = label.current;
    if (!element) return;
    let active = true;
    const fit = () => {
      element.style.fontSize = "";
      const available = element.clientWidth;
      const needed = element.scrollWidth;
      if (available > 0 && needed > available) {
        const normalSize = Number.parseFloat(getComputedStyle(element).fontSize);
        element.style.fontSize = `${Math.floor((normalSize * available * 10) / needed) / 10}px`;
      }
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(element);
    void document.fonts?.ready.then(() => {
      if (active) fit();
    });
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [children]);

  return (
    <span ref={label} className="block w-full overflow-hidden leading-5 whitespace-nowrap">
      {children}
    </span>
  );
}
