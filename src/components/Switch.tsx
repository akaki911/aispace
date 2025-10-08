import type { ButtonHTMLAttributes } from 'react';

export interface SwitchProps extends Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label' | 'id' | 'name'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Switch = ({
  checked = false,
  disabled = false,
  onChange,
  onCheckedChange,
  label,
  className,
  ...rest
}: SwitchProps): JSX.Element => {
  const handleClick = () => {
    if (disabled) {
      return;
    }

    const nextValue = !checked;
    onChange?.(nextValue);
    onCheckedChange?.(nextValue);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={className}
      onClick={handleClick}
      {...rest}
    >
      {label ?? (checked ? 'On' : 'Off')}
    </button>
  );
};

export default Switch;
