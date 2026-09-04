import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import styles from "./ui.module.css";

const EMPTY_VALUE = "__openquester_empty__";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
};

const encodeValue = (value: string) => value || EMPTY_VALUE;
const decodeValue = (value: string) => (value === EMPTY_VALUE ? "" : value);

export function SelectField({
  value,
  onValueChange,
  options,
  ariaLabel,
  disabled,
  name,
  required,
}: SelectFieldProps) {
  return (
    <Select.Root
      value={encodeValue(value)}
      onValueChange={(nextValue) => onValueChange(decodeValue(nextValue))}
      disabled={disabled}
      name={name}
      required={required}
    >
      <Select.Trigger className={styles.selectTrigger} aria-label={ariaLabel}>
        <Select.Value />
        <Select.Icon className={styles.selectIcon}>
          <ChevronDown size={15} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.selectContent}
          position="popper"
          sideOffset={6}
          collisionPadding={10}
        >
          <Select.Viewport className={styles.selectViewport}>
            {options.map((option) => (
              <Select.Item
                className={styles.selectItem}
                disabled={option.disabled}
                key={encodeValue(option.value)}
                value={encodeValue(option.value)}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className={styles.selectIndicator}>
                  <Check size={14} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
