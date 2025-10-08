import React from 'react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  onChange,
  height = '240px',
  className,
  placeholder,
  readOnly = false,
}) => {
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{
        minHeight: resolvedHeight,
      }}
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        readOnly={readOnly}
        className="h-full w-full resize-none bg-transparent p-3 font-mono text-sm text-[#E6E8EC] outline-none"
        style={{ minHeight: resolvedHeight }}
        aria-label="Prompt editor"
      />
    </div>
  );
};

export default PromptEditor;
