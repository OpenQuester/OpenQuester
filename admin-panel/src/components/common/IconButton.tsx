import { type ButtonHTMLAttributes, type ReactNode } from "react";

export enum IconButtonVariant {
  DEFAULT = "default",
  DANGER = "danger",
  SUCCESS = "success",
  WARNING = "warning",
}

export enum IconButtonSize {
  SM = "sm",
  MD = "md",
}

export enum IconButtonSizeClass {
  SM = "p-1.5",
  MD = "p-2",
}

export enum IconButtonVariantClass {
  DEFAULT = "text-secondaryText hover:text-primaryText",
  DANGER = "text-error-600 hover:text-error-700",
  SUCCESS = "text-success-600 hover:text-success-700",
  WARNING = "text-warning-600 hover:text-warning-700",
}

// Helper accessors so we can index via enum value (string) -> enum key mapping
const sizeToClass = (s: IconButtonSize): string =>
  s === IconButtonSize.SM ? IconButtonSizeClass.SM : IconButtonSizeClass.MD;

const variantToClass = (v: IconButtonVariant): string => {
  switch (v) {
    case IconButtonVariant.DANGER:
      return IconButtonVariantClass.DANGER;
    case IconButtonVariant.SUCCESS:
      return IconButtonVariantClass.SUCCESS;
    case IconButtonVariant.WARNING:
      return IconButtonVariantClass.WARNING;
    case IconButtonVariant.DEFAULT:
    default:
      return IconButtonVariantClass.DEFAULT;
  }
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string;
  children: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  title?: string; // optional tooltip
}

export const IconButton = ({
  ariaLabel,
  children,
  className = "",
  size = IconButtonSize.MD,
  variant = IconButtonVariant.DEFAULT,
  title,
  ...rest
}: IconButtonProps) => {
  return (
    <button
      aria-label={ariaLabel}
      title={title || ariaLabel}
      className={`btn btn-ghost rounded-lg focus-ring inline-flex items-center justify-center transition-colors ${sizeToClass(
        size
      )} ${variantToClass(variant)} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
