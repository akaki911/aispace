// @ts-nocheck

import React, { useRef, useEffect, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Save, Edit, X, Check, Copy, AlertTriangle } from 'lucide-react';
import { decodeCodeContent, formatCode, encodeCodeContent } from '../utils/codeDecoder';

interface OpenFile {
  path: string;
  name: string;
  content: string;
  loading: boolean;
  error?: string;
  isEditing?: boolean;
  originalContent?: string;
  hasUnsavedChanges?: boolean;
}

interface FileViewerProps {
  file: OpenFile;
  isEditable: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onContentChange: (content: string) => void;
}

const FileViewer: React.FC<FileViewerProps> = ({
  file,
  isEditable,
  onEdit,
  onSave,
  onCancel,
  onContentChange
}) => {
  const editorRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [decodedContent, setDecodedContent] = useState<string>('');
  const [contentError, setContentError] = useState<string>('');
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Decode content when file content changes
  useEffect(() => {
    if (file.content) {
      const decoded = decodeCodeContent(file.content, file.name);
      if (decoded.success) {
        const formatted = formatCode(decoded.content, decoded.language || getLanguage(file.name));
        setDecodedContent(formatted);
        setContentError('');
      } else {
        setDecodedContent(file.content);
        setContentError(decoded.error || 'Failed to decode content');
      }
    } else {
      setDecodedContent('');
      setContentError('');
    }
  }, [file.content, file.name]);

  const getLanguage = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js': return 'javascript';
      case 'jsx': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'md': return 'markdown';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': 
      case 'cc': 
      case 'cxx': return 'cpp';
      case 'c': return 'c';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'sh': return 'shell';
      case 'yml':
      case 'yaml': return 'yaml';
      case 'xml': return 'xml';
      case 'sql': return 'sql';
      case 'env': return 'shell';
      case 'gitignore': return 'shell';
      case 'dockerfile': return 'dockerfile';
      default: return 'plaintext';
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure Monaco Editor theme to match Replit
    monaco.editor.defineTheme('replit-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'constant', foreground: '4fc1ff' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'delimiter', foreground: 'd4d4d4' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2d2d30',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editorCursor.foreground': '#aeafad',
        'editorWhitespace.foreground': '#404040'
      }
    });

    monaco.editor.setTheme('replit-dark');
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", consolas, "source-code-pro", monospace',
      lineHeight: 1.6,
      letterSpacing: 0.5,
      padding: { top: 16, bottom: 16 },
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: true,
      folding: true,
      renderLineHighlight: 'line',
      cursorBlinking: 'phase',
      cursorSmoothCaretAnimation: true,
      smoothScrolling: true,
      contextmenu: true,
      mouseWheelZoom: true,
      formatOnPaste: true,
      formatOnType: true,
      autoIndent: 'full',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      trimAutoWhitespace: true,
      renderWhitespace: 'selection',
      renderControlCharacters: false,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (file.isEditing && file.hasUnsavedChanges) {
        onSave();
      }
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && file.isEditing) {
      // Update decoded content state
      setDecodedContent(value);
      // Pass the encoded content back if needed
      onContentChange(value);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(decodedContent);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (file.loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          <span>ფაილი იტვირთება...</span>
        </div>
      </div>
    );
  }

  if (file.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-red-400 p-6">
        <div className="text-lg mb-2">შეცდომა ფაილის ჩატვირთვისას</div>
        <div className="text-sm text-gray-500 text-center max-w-md">
          {file.error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* File Header - Replit Style */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm font-mono">
              {file.path.split('/').slice(0, -1).join('/')}
            </span>
            {file.path.includes('/') && (
              <span className="text-gray-600">/</span>
            )}
            <span className="text-white font-semibold text-sm">
              {file.name}
            </span>
          </div>
          {file.hasUnsavedChanges && (
            <div className="w-2 h-2 bg-yellow-400 rounded-full" title="შეუნახავი ცვლილებები"></div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Copy Button */}
          <button
            onClick={copyToClipboard}
            className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center space-x-1"
            title="Copy to clipboard"
          >
            <Copy size={14} />
            <span>{showCopySuccess ? 'კოპირებულია!' : 'კოპირება'}</span>
          </button>

          {!file.isEditing && isEditable && (
            <button
              onClick={onEdit}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center space-x-1"
            >
              <Edit size={14} />
              <span>რედაქტირება</span>
            </button>
          )}
          
          {file.isEditing && (
            <div className="flex items-center space-x-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center space-x-1"
              >
                <X size={14} />
                <span>გაუქმება</span>
              </button>
              <button
                onClick={onSave}
                disabled={!file.hasUnsavedChanges}
                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors flex items-center space-x-1"
              >
                <Save size={14} />
                <span>შენახვა</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Error Display */}
      {contentError && (
        <div className="px-4 py-2 bg-yellow-900 border-b border-yellow-700 text-yellow-200 text-sm flex items-center space-x-2">
          <AlertTriangle size={16} />
          <span>შეფარდების გაფრთხილება: {contentError}</span>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 relative" style={{ minHeight: '300px' }}>
        {mounted && (
          <Editor
            height="100%"
            language={getLanguage(file.name)}
            value={decodedContent}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme="replit-dark"
            options={{
              readOnly: !file.isEditing,
              domReadOnly: !file.isEditing,
              contextmenu: file.isEditing,
              wordWrap: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", consolas, "source-code-pro", monospace',
              lineHeight: 1.6,
              padding: { top: 16, bottom: 16 },
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              glyphMargin: true,
              folding: true,
              renderLineHighlight: file.isEditing ? 'line' : 'none',
              cursorBlinking: file.isEditing ? 'phase' : 'solid',
              cursorStyle: file.isEditing ? 'line' : 'block',
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true
              },
              // Optimize for large files
              quickSuggestions: false,
              parameterHints: { enabled: false },
              suggestOnTriggerCharacters: false,
              acceptSuggestionOnEnter: 'off',
              tabCompletion: 'off',
              wordBasedSuggestions: false,
              // Handle tokenization for large files
              largeFileOptimizations: true,
              maxTokenizationLineLength: 20000,
              // Improve scrolling performance
              smoothScrolling: true,
              fastScrollSensitivity: 5,
              // Memory optimization
              stopRenderingLineAfter: 10000
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div 
        className="flex items-center justify-between px-4 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400"
        style={{ height: '28px' }}
      >
        <div className="flex items-center space-x-4">
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <span className="capitalize">{getLanguage(file.name)}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {file.isEditing ? (
            <span className="text-yellow-400">რედაქტირების რეჟიმი</span>
          ) : (
            <span className="text-green-400">მხოლოდ ნახვა</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
