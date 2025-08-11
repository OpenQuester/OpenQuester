import { forwardRef, type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = "default", padding = "md", children, className = "", ...props },
    ref
  ) => {
    const baseClasses = "card";

    const variantClasses = {
      default: "",
      hover: "card-hover",
      glass: "glass-effect",
    };

    const paddingClasses = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const classes = [
      baseClasses,
      variantClasses[variant],
      paddingClasses[padding],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const CardHeader = ({
  title,
  description,
  action,
  className = "",
  ...props
}: CardHeaderProps) => (
  <div className={`border-b border-border px-6 py-4 ${className}`} {...props}>
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-primaryText">{title}</h3>
        {description && (
          <p className="text-sm text-secondaryText mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  </div>
);

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = "", ...props }, ref) => (
    <div ref={ref} className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = "CardContent";
