import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}

export const EmptyState = ({
  icon,
  title,
  message,
  hint,
  action,
  compact = false,
}: EmptyStateProps) => {
  return (
    <div className={`text-center ${compact ? "py-6" : "py-12"}`}>
      {icon && (
        <div className="mb-4 flex items-center justify-center">{icon}</div>
      )}
      <h3 className="text-lg font-medium text-primaryText mb-2">{title}</h3>
      <p className="text-secondaryText max-w-md mx-auto">{message}</p>
      {hint && <p className="mt-2 text-sm text-mutedText">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
