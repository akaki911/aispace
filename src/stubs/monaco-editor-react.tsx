import type { ComponentPropsWithoutRef, FC } from 'react';

type EditorProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'onChange'> & {
  value?: string;
  defaultLanguage?: string;
  onChange?: (value: string | undefined) => void;
  theme?: string;
  options?: Record<string, unknown>;
};

const Editor: FC<EditorProps> = ({ value, onChange, defaultLanguage: _defaultLanguage, theme: _theme, options: _options, ...props }) => (
  <textarea
    {...props}
    value={value}
    onChange={(event) => {
      onChange?.(event.target.value);
    }}
  />
);

export default Editor;
