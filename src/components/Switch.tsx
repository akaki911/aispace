import clsx from 'classnames';
import type { ButtonHTMLAttributes, FC } from 'react';

type SwitchProps = {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (value: boolean) => void;
  label?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'onClick'>;

export const Switch: FC<SwitchProps> = ({
  checked = false,
  disabled = false,
  onCheckedChange,
  label,
  className,
  ...rest
}) => {
  const handleClick = () => {
    if (disabled) {
      return;
    }
    onCheckedChange?.(!checked);
  };

  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition',
        checked ? 'bg-emerald-500 text-white' : 'bg-slate-700/70 text-slate-200',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      aria-pressed={checked}
      onClick={handleClick}
      disabled={disabled}
      {...rest}
    >
      <span
        className={clsx(
          'h-4 w-4 rounded-full border border-white/30 transition',
          checked ? 'translate-x-1 bg-white' : 'translate-x-0 bg-slate-600',
        )}
      />
      {label ?? (checked ? 'Enabled' : 'Disabled')}
    </button>
  );
};

export default Switch;
