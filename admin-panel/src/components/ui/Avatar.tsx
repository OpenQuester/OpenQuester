import { User } from "lucide-react";
import { memo, useState } from "react";

export interface AvatarProps {
  /** Avatar image URL (presigned S3 link) */
  src?: string | null;
  /** Fallback text (usually username or name) */
  fallback: string;
  /** Size of the avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Additional CSS classes */
  className?: string;
  /** Alternative text for accessibility */
  alt?: string;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-xl",
  xl: "w-20 h-20 text-2xl",
} as const;

const iconSizeClasses = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
} as const;

/**
 * Avatar component that displays user profile images with fallback styling.
 * When no avatar is provided, shows the first letter of the fallback text
 */
export const Avatar = memo(
  ({ src, fallback, size = "md", className = "", alt }: AvatarProps) => {
    const [imageError, setImageError] = useState(false);
    const sizeClass = sizeClasses[size];
    const iconSizeClass = iconSizeClasses[size];

    // Get the first character for fallback display
    const fallbackChar = fallback.charAt(0).toUpperCase();

    const baseClasses = `${sizeClass} flex-shrink-0 rounded-full flex items-center justify-center font-semibold ${className}`;

    // If we have a valid image source and no error, try to display it
    if (src && !imageError) {
      return (
        <div className={baseClasses}>
          <img
            src={src}
            alt={alt || `${fallback}'s avatar`}
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              console.warn("Avatar image failed to load:", src, e);
              setImageError(true);
            }}
            onLoad={() => setImageError(false)}
          />
        </div>
      );
    }

    // Fallback: show first letter on gradient background or user icon if no fallback
    return (
      <div
        className={`${baseClasses} bg-gradient-to-br from-primary-500 to-purple-600 text-white`}
      >
        {fallbackChar ? (
          <span>{fallbackChar}</span>
        ) : (
          <User className={iconSizeClass} />
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
