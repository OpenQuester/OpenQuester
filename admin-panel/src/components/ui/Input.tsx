import { type LucideIcon } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      onRightIconClick,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-secondaryText"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {LeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LeftIcon className="h-5 w-5 text-mutedText" />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`input ${LeftIcon ? "pl-10" : ""} ${
              RightIcon ? "pr-10" : ""
            } ${
              error
                ? "border-error-500 focus:border-error-500 focus:ring-error-500"
                : ""
            } ${className}`}
            {...props}
          />

          {RightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {onRightIconClick ? (
                <button
                  type="button"
                  onClick={onRightIconClick}
                  className="text-mutedText hover:text-secondaryText transition-colors focus:outline-none"
                >
                  <RightIcon className="h-5 w-5" />
                </button>
              ) : (
                <RightIcon className="h-5 w-5 text-mutedText" />
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-error-600">{error}</p>}

        {hint && !error && <p className="text-sm text-mutedText">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
