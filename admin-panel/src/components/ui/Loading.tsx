import { type LucideIcon } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = ({
  size = "md",
  className = "",
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={`loading-spinner ${sizeClasses[size]} ${className}`} />
  );
};

interface LoadingCardProps {
  lines?: number;
}

export const LoadingCard = ({ lines = 3 }: LoadingCardProps) => (
  <div className="card animate-pulse">
    <div className="p-6">
      <div className="space-y-3">
        {[...Array(lines)].map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 rounded"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
    </div>
  </div>
);

interface LoadingStateProps {
  icon?: LucideIcon;
  message?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingState = ({
  icon: Icon,
  message = "Loading...",
  size = "md",
}: LoadingStateProps) => {
  const containerClasses = {
    sm: "py-8",
    md: "py-12",
    lg: "py-16",
  };

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${containerClasses[size]}`}
    >
      <div className="flex items-center space-x-3">
        {Icon ? (
          <Icon className={`${iconSizes[size]} text-gray-400 animate-pulse`} />
        ) : (
          <LoadingSpinner size={size} />
        )}
        <span className="text-mutedText font-medium">{message}</span>
      </div>
    </div>
  );
};
