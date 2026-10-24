import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export type ButtonVariant = "accent" | "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const variants: Record<ButtonVariant, string> = {
  accent: "bg-accent text-on-accent border-2 border-accent-strong hover:brightness-105",
  primary: "bg-primary text-on-primary border border-transparent hover:brightness-110",
  secondary: "bg-surface-3 text-text border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text border border-line-strong hover:bg-surface-2",
  danger: "bg-danger-surface text-danger border border-danger/40 hover:brightness-110",
  success: "bg-success-surface text-success border border-success-line hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3.5 text-sm rounded-sm",
  md: "min-h-11 px-4 text-[15px] rounded-[12px]",
  lg: "min-h-14 px-6 text-lg rounded-md",
  xl: "min-h-20 px-8 text-2xl rounded-[18px] font-display font-extrabold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered as a non-interactive button that still explains itself. */
  inactive?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  inactive,
  disabled,
  icon,
  fullWidth,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const off = disabled || inactive;
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={inactive || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-[filter,background-color] select-none",
        sizes[size],
        off
          ? "bg-surface-2 text-faint border border-line-strong cursor-not-allowed"
          : variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
