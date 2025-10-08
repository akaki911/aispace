import React, { useCallback } from 'react';

export interface EditorProps {
  value?: string;
  defaultLanguage?: string;
  height?: number | string;
  theme?: string;
  options?: Record<string, unknown>;
  className?: string;
  onChange?: (value?: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onMount?: () => void;
}

const Editor: React.FC<EditorProps> = ({
  value,
  height = 260,
  className,
  onChange,
  defaultLanguage,
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.target.value, event);
    },
    [onChange],
  );

  const ariaLabel = defaultLanguage
    ? `Monaco editor stub (${defaultLanguage})`
    : 'Monaco editor stub';

  return (
    <textarea
      value={value ?? ''}
      onChange={handleChange}
      aria-label={ariaLabel}
      className={className ?? 'monaco-editor-stub'}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    />
  );
};

export default Editor;
