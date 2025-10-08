export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Switch = ({ onChange }: SwitchProps): JSX.Element => {
  const handleClick = () => {
    onChange?.(true);
  };

  return (
    <button type="button" onClick={handleClick} aria-label="Switch stub">
      •
    </button>
  );
};

export default Switch;
