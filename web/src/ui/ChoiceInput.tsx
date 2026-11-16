import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./icons";

export function ChoiceInput({
  type,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { type: "checkbox" | "radio" }) {
  const radio = type === "radio";
  return (
    <span className="relative inline-flex size-5 shrink-0">
      <input
        {...props}
        type={type}
        className={cn(
          "peer size-full cursor-pointer appearance-none border border-line-strong bg-bg transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50 forced-colors:appearance-auto",
          radio ? "rounded-full" : "rounded-[5px]",
          className,
        )}
      />
      <span
        className="pointer-events-none absolute inset-0 hidden place-items-center text-on-accent peer-checked:grid forced-colors:peer-checked:hidden"
        aria-hidden="true"
      >
        {radio ? <span className="size-2 rounded-full bg-current" /> : <CheckIcon size={14} />}
      </span>
    </span>
  );
}
