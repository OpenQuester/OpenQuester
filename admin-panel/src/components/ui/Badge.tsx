import { forwardRef, type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "error" | "gray";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "gray",
      size = "md",
      dot = false,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseClasses = "badge";

    const variantClasses = {
      primary: "badge-primary",
      success: "badge-success",
      warning: "badge-warning",
      error: "badge-error",
      gray: "badge-gray",
    };

    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    };

    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span ref={ref} className={classes} {...props}>
        {dot && (
          <div
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              variant === "primary"
                ? "bg-primary-600"
                : variant === "success"
                ? "bg-success-600"
                : variant === "warning"
                ? "bg-warning-600"
                : variant === "error"
                ? "bg-error-600"
                : "bg-gray-600"
            }`}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
