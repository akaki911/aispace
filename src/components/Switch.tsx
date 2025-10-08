import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...rest
}) => {
  const handleToggle = () => {
    if (disabled) {
      return;
    }
    onCheckedChange?.(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/10 transition ${
        checked ? 'bg-emerald-500/80' : 'bg-slate-700'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className ?? ''}`.trim()}
      {...rest}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

export default Switch;
