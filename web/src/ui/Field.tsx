import { cn } from "@/lib/cn";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

const fieldBase =
  "min-h-12 min-w-0 rounded-[12px] border border-line-strong bg-bg px-4 text-base text-text font-medium focus:border-info outline-none";

export const inputClass = `${fieldBase} w-full`;

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
  },
);

export function Select({
  className,
  multiple,
  size,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const dropdown = !multiple && (size == null || size <= 1);
  return (
    <select
      className={cn(fieldBase, dropdown && "select-arrow pr-12", className ?? "w-full")}
      multiple={multiple}
      size={size}
      {...rest}
    />
  );
}

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("text-[15px] font-semibold", className)}>
      {children}
    </label>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="m-0 text-sm text-danger">
      {children}
    </p>
  );
}

/** A label, its control, and optional supporting text with consistent spacing. */
export function FieldGroup({
  htmlFor,
  label,
  help,
  children,
}: {
  htmlFor: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help && <span className="text-sm text-faint">{help}</span>}
    </div>
  );
}
