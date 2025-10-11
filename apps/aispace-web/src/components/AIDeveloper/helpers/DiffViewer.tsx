
import React from 'react';
import { Plus, Minus, FileText } from 'lucide-react';

interface DiffViewerProps {
  oldContent?: string;
  newContent?: string;
  fileName?: string;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ 
  oldContent = '', 
  newContent = '', 
  fileName,
  className = ""
}) => {
  const getDiffLines = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    const diffLines = [];
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine !== newLine) {
        if (oldLine && !newLine) {
          diffLines.push({ type: 'removed', content: oldLine, lineNumber: i + 1 });
        } else if (!oldLine && newLine) {
          diffLines.push({ type: 'added', content: newLine, lineNumber: i + 1 });
        } else {
          diffLines.push({ type: 'removed', content: oldLine, lineNumber: i + 1 });
          diffLines.push({ type: 'added', content: newLine, lineNumber: i + 1 });
        }
      } else {
        diffLines.push({ type: 'unchanged', content: oldLine, lineNumber: i + 1 });
      }
    }
    
    return diffLines;
  };

  const diffLines = getDiffLines(oldContent, newContent);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {fileName && (
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2 text-gray-300">
            <FileText size={16} />
            <span className="font-mono text-sm">{fileName}</span>
          </div>
        </div>
      )}
      
      <div className="max-h-96 overflow-y-auto">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={`flex items-start px-4 py-1 font-mono text-sm ${
              line.type === 'added'
                ? 'bg-green-900/20 text-green-300'
                : line.type === 'removed'
                ? 'bg-red-900/20 text-red-300'
                : 'text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-[60px] text-xs text-gray-500">
              {line.type === 'added' && <Plus size={12} className="text-green-400" />}
              {line.type === 'removed' && <Minus size={12} className="text-red-400" />}
              <span>{line.lineNumber}</span>
            </div>
            <div className="flex-1 pl-2">
              {line.content || ' '}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
