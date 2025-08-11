import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  maxHeight?: number; // px for panel scroll constraint
}

// Accessible custom select (listbox pattern)
export const Select = ({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  placeholder = "Select",
  maxHeight = 260,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const id = useId();
  const label = options.find((o) => o.value === value)?.label || placeholder;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!listRef.current && !buttonRef.current) return;
      if (
        listRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus selected option when opening (after paint)
  useLayoutEffect(() => {
    if (open && listRef.current) {
      const selectedIdx = options.findIndex((o) => o.value === value);
      if (selectedIdx >= 0) setActiveIndex(selectedIdx);
      // scroll into view
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector<HTMLElement>(
          `[data-index='${selectedIdx}']`
        );
        el?.scrollIntoView({ block: "nearest" });
      });
    }
  }, [open, options, value]);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      if (opt.value !== value) {
        onChange(opt.value);
      }
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onChange, options, value]
  );

  const openList = () => setOpen(true);
  const closeList = () => setOpen(false);

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        openList();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setOpen((o) => !o);
        break;
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeList();
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => {
          for (let n = 1; n <= options.length; n++) {
            const idx = (i + n) % options.length;
            if (!options[idx].disabled) return idx;
          }
          return i;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => {
          for (let n = 1; n <= options.length; n++) {
            const idx = (i - n + options.length) % options.length;
            if (!options[idx].disabled) return idx;
          }
          return i;
        });
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(() =>
          Math.max(
            0,
            options.findIndex((o) => !o.disabled)
          )
        );
        break;
      case "End":
        e.preventDefault();
        for (let n = options.length - 1; n >= 0; n--) {
          if (!options[n].disabled) {
            setActiveIndex(n);
            break;
          }
        }
        break;
      case "PageUp":
      case "PageDown":
        // ignore (no virtualization)
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
    }
  };

  useEffect(() => {
    if (!open) return;
    if (activeIndex < 0 || activeIndex >= options.length) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index='${activeIndex}']`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, options.length]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-button`}
        aria-label={ariaLabel || placeholder}
        id={`${id}-button`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className="group w-full min-w-[160px] justify-between flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card/80 border border-border text-sm font-medium text-secondaryText focus:border-primary-500 focus:ring-2 focus:ring-primary-600/40 hover:border-primary-400 transition-colors cursor-pointer backdrop-blur-sm shadow-sm focus:outline-none"
      >
        <span className="truncate text-left flex-1">{label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            open ? "rotate-180" : ""
          } text-mutedText group-hover:text-secondaryText`}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-activedescendant={`${id}-option-${activeIndex}`}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute z-50 mt-2 w-full max-h-[260px] overflow-y-auto rounded-lg border border-border shadow-lg bg-card/95 backdrop-blur-md focus:outline-none ring-1 ring-black/5"
          style={{ maxHeight }}
        >
          {options.map((opt, i) => {
            const selected = opt.value === value;
            const active = i === activeIndex;
            return (
              <li
                id={`${id}-option-${i}`}
                key={opt.value}
                data-index={i}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={`group relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors rounded-md mx-1 my-[2px] ${
                  opt.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : active
                    ? "bg-primary-100 text-primary-700"
                    : selected
                    ? "bg-primary-50 text-primary-700"
                    : "text-secondaryText hover:bg-hover hover:text-primaryText"
                }`}
              >
                <span className="truncate flex-1">{opt.label}</span>
                {selected && (
                  <Check className="h-4 w-4 text-primary-600 group-hover:text-primary-700" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
