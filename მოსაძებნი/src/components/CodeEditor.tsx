import React from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  filePath?: string;
  onSave?: (content: string) => void;
}

export default function CodeEditor({ 
  value, 
  onChange, 
  language = 'typescript', 
  readOnly = false,
  filePath,
  onSave 
}: CodeEditorProps) {

  // Handle Ctrl+S for saving
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (onSave && !readOnly) {
        onSave(value);
      }
    }
  };

  return (
    <div className="h-full bg-gray-900 text-gray-100 font-mono text-sm">
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <span className="text-gray-400 text-xs">
          {readOnly ? '👁️ მხოლოდ ნახვა' : '✏️ რედაქტირება'} • {language}
          {filePath && ` • ${filePath}`}
        </span>
        {!readOnly && onSave && (
          <button
            onClick={() => onSave(value)}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white"
          >
            💾 შენახვა (Ctrl+S)
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        className="w-full h-full p-4 bg-transparent resize-none outline-none border-none text-sm leading-relaxed scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600"
        placeholder={readOnly ? "ფაილი ცარიელია..." : "კოდის დაწერა დაიწყეთ აქ..."}
        spellCheck={false}
      />
    </div>
  );
}