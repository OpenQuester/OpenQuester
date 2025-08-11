import { type LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "success"
    | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon: Icon,
      iconPosition = "left",
      fullWidth = false,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = "btn focus-ring";

    const variantClasses = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
      success: "btn-success",
      warning:
        "bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 active:bg-warning-800",
    };

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const isDisabled = disabled || loading;

    return (
      <button ref={ref} className={classes} disabled={isDisabled} {...props}>
        <div className="flex items-center justify-center space-x-2">
          {loading && <div className="loading-spinner h-4 w-4" />}

          {Icon && iconPosition === "left" && !loading && (
            <Icon className="h-4 w-4" />
          )}

          {children && <span>{children}</span>}

          {Icon && iconPosition === "right" && !loading && (
            <Icon className="h-4 w-4" />
          )}
        </div>
      </button>
    );
  }
);

Button.displayName = "Button";
