import { forwardRef } from 'react';

type SwitchProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const baseTrackClasses = 'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500';
const baseThumbClasses = 'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200';

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, className = '', ...props }, ref) => {
    const trackClasses = `${baseTrackClasses} ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200 bg-gray-200'} ${className}`;
    const thumbClasses = `${baseThumbClasses} ${checked ? 'translate-x-5' : 'translate-x-1'}`;

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        onClick={() => onCheckedChange?.(!checked)}
        className={trackClasses}
        {...props}
      >
        <span className={thumbClasses} />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;
