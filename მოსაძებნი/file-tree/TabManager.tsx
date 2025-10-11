import React, { useCallback, useRef } from 'react';
import { IconX, IconLoader2, IconAlertTriangle, IconCopy, IconCheck } from '@tabler/icons-react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import classNames from 'classnames';
import { Tab } from '../../types/fileTree';
import { getMonacoLanguage, encodeForHeader } from '../../utils/fileTreeUtils';

interface TabManagerProps {
  openTabs: Tab[];
  activeTab: string | null;
  setActiveTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  savingTabs: Set<string>;
  setSavingTabs: React.Dispatch<React.SetStateAction<Set<string>>>;
  savedTabs: Set<string>;
  setSavedTabs: React.Dispatch<React.SetStateAction<Set<string>>>;
  copiedToClipboard: boolean;
  setCopiedToClipboard: (copied: boolean) => void;
  loadingTabs: Set<string>; // Added for loading state
  setLoadingTabs: React.Dispatch<React.SetStateAction<Set<string>>>; // Added for loading state
  setOpenTabs: React.Dispatch<React.SetStateAction<Tab[]>>; // Added missing prop
}

export const TabManager: React.FC<TabManagerProps> = ({
  openTabs,
  activeTab,
  setActiveTab,
  closeTab,
  savingTabs,
  setSavingTabs,
  savedTabs,
  setSavedTabs,
  copiedToClipboard,
  setCopiedToClipboard,
  loadingTabs, // Added for loading state
  setLoadingTabs, // Added for loading state
  setOpenTabs // Added missing prop
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Save file content
  const saveFileContent = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    try {
      const tabId = `tab-${filePath}`;
      setSavingTabs(prev => new Set([...prev, tabId]));

      console.log('💾 Saving file content for:', filePath);
      const requestPath = encodeForHeader(filePath);

      const response = await fetch(`/api/files/save/${requestPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: content
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('💾 File save error:', response.status, errorText);
        throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
      }

      console.log('✅ File saved successfully:', filePath);

      // Mark as saved temporarily
      setSavedTabs(prev => new Set([...prev, tabId]));
      setTimeout(() => {
        setSavedTabs(prev => {
          const newSet = new Set(prev);
          newSet.delete(tabId);
          return newSet;
        });
      }, 2000);

      return true;

    } catch (err: any) {
      console.error('💾 Failed to save file content:', err);
      return false;
    } finally {
      setSavingTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(`tab-${filePath}`);
        return newSet;
      });
    }
  }, [setSavingTabs, setSavedTabs]);

  // Handle editor content changes
  const handleEditorChange = useCallback((value: string | undefined, tabId: string) => {
    if (!tabId || !value) return;

    // This would update the tab content - implement based on your state management
    // For now, we'll just log it
    console.log('Editor content changed for tab:', tabId, 'Length:', value.length);
  }, []);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco, tabId: string) => {
    editorRef.current = editor;

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      const tab = openTabs.find(t => t.id === tabId);
      if (tab?.content && tab.hasUnsavedChanges && !savingTabs.has(tab.id)) {
        try {
          await saveFileContent(tab.path, tab.content);
        } catch (error) {
          console.error('💾 Failed to save via keyboard shortcut:', error);
        }
      }
    });

    // Define custom theme
    monaco.editor.defineTheme('replit-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0', fontStyle: 'bold' },
        { token: 'function', foreground: 'dcdcaa', fontStyle: 'bold' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'constant', foreground: '4fc1ff', fontStyle: 'bold' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#7d8590',
        'editorCursor.foreground': '#79c0ff',
      }
    });

    monaco.editor.setTheme('replit-dark');
  }, [openTabs, savingTabs, saveFileContent]);

  // Copy content to clipboard
  const copyToClipboard = useCallback(() => {
    const activeTabContent = openTabs.find(tab => tab.id === activeTab);
    if (!activeTabContent?.content) return;

    try {
      navigator.clipboard.writeText(activeTabContent.formattedContent || activeTabContent.content);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [activeTab, openTabs, setCopiedToClipboard]);

  // Enhanced file loading with timeout and better error handling
  const loadFileContent = useCallback(async (tab: Tab) => {
    if (!tab.path) return;

    let abortController: AbortController | null = null;

    try {
      console.log(`📂 Loading file: ${tab.path}`);
      setLoadingTabs(prev => new Set([...prev, tab.path]));

      // Create abort controller for timeout
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController?.abort('Request timeout');
      }, 15000); // 15 second timeout

      // Enhanced path encoding for Georgian files
      let encodedPath = tab.path;
      try {
        // Handle Georgian characters properly
        if (/[\u10A0-\u10FF]/.test(tab.path)) {
          encodedPath = tab.path; // Keep Georgian as-is
        } else {
          encodedPath = encodeURIComponent(tab.path);
        }
      } catch (e) {
        console.warn('Path encoding warning:', e);
        encodedPath = tab.path;
      }

      console.log(`📂 Fetching: /api/files/content/${encodedPath}`);

      const response = await fetch(`/api/files/content/${encodedPath}`, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'text/plain, application/json, */*',
          'Cache-Control': 'no-cache'
        },
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const content = await response.text();
      console.log(`✅ File loaded successfully: ${tab.path} (${content.length} chars)`);

      setOpenTabs(prev => prev.map(t => 
        t.path === tab.path 
          ? { ...t, content, isLoading: false, hasError: false }
          : t
      ));

    } catch (error) {
      console.error(`❌ Failed to load file ${tab.path}:`, error);

      let errorMessage = 'ფაილის ჩატვირთვა ვერ მოხერხდა';

      if (error.name === 'AbortError') {
        errorMessage = 'ფაილის ჩატვირთვა ჩაიყოლა (timeout)';
      } else if (error.message?.includes('404')) {
        errorMessage = 'ფაილი ვერ მოიძებნა';
      } else if (error.message?.includes('403')) {
        errorMessage = 'ფაილზე წვდომა აიკრძალა';
      } else if (error.message?.includes('500')) {
        errorMessage = 'სერვერის შეცდომა';
      } else if (error.message) {
        errorMessage = `შეცდომა: ${error.message}`;
      }

      setOpenTabs(prev => prev.map(t => 
        t.path === tab.path 
          ? { 
              ...t, 
              content: `# ❌ ${errorMessage}\n\n\`\`\`\nPath: ${tab.path}\nError: ${error.message}\nTime: ${new Date().toLocaleString('ka-GE')}\n\`\`\`\n\n**შემოწმების ქმედებები:**\n- გადატვირთეთ ფაილი (Ctrl+R)\n- შეამოწმეთ ფაილის გზა\n- დარწმუნდით რომ ფაილი არსებობს`, 
              isLoading: false,
              hasError: true
            }
          : t
      ));
    } finally {
      setLoadingTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(tab.path);
        return newSet;
      });

      if (abortController) {
        try {
          abortController.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [setOpenTabs, setLoadingTabs]);

  if (openTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d1117]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-[#e6edf3] mb-2">მარჯვენა მხარეს გაიხსნება ფაილები</h3>
          <p className="text-sm text-[#7d8590]">
            ფაილის გახსნისთვის დაკლიკეთ მასზე File Tree-ში
          </p>
        </div>
      </div>
    );
  }

  const activeTabData = openTabs.find(tab => tab.id === activeTab);

  return (
    <div className="flex-1 flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center bg-[#161b22] border-b border-[#21262d] overflow-x-auto">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={classNames(
              'flex items-center space-x-2 px-3 py-2 border-r border-[#21262d] cursor-pointer group relative flex-shrink-0',
              tab.id === activeTab
                ? 'bg-[#0d1117] text-[#e6edf3]'
                : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d]'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="text-sm truncate max-w-32" title={tab.path}>
              {tab.name}
            </span>

            {/* Tab indicators */}
            <div className="flex items-center space-x-1">
              {savingTabs.has(tab.id) && (
                <IconLoader2 className="w-3 h-3 animate-spin" />
              )}
              {savedTabs.has(tab.id) && (
                <IconCheck className="w-3 h-3 text-green-500" />
              )}
              {tab.hasUnsavedChanges && !savingTabs.has(tab.id) && (
                <div className="w-2 h-2 bg-[#58a6ff] rounded-full" />
              )}
              {tab.hasError && (
                <IconAlertTriangle className="w-3 h-3 text-red-500" />
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <IconX className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative">
        {activeTabData ? (
          <>
            {/* Loading state */}
            {loadingTabs.has(activeTabData.path) && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm text-[#e6edf3] mb-2">📂 იტვირთება: {activeTabData.name}</p>
                  <p className="text-xs text-[#7d8590]">{activeTabData.path}</p>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setLoadingTabs(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(activeTabData.path);
                          return newSet;
                        });
                      }}
                      className="text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-2 py-1 rounded transition-colors"
                    >
                      ❌ გაუქმება
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-[#161b22] border-b border-[#21262d]">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#7d8590]">
                  {activeTabData.path}
                </span>
                {activeTabData.hasUnsavedChanges && (
                  <span className="text-xs text-[#58a6ff]">• შეუნახავი</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={copyToClipboard}
                  className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                  title="კოპირება"
                >
                  {copiedToClipboard ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                </button>

                {activeTabData.hasUnsavedChanges && !savingTabs.has(activeTabData.id) && (
                  <button
                    onClick={() => saveFileContent(activeTabData.path, activeTabData.content || '')}
                    className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-2 py-1 rounded transition-colors"
                  >
                    შენახვა
                  </button>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1">
              {activeTabData.hasError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <IconAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-[#e6edf3] mb-2">ფაილის ჩატვირთვის შეცდომა</h3>
                    <p className="text-sm text-[#7d8590]">{activeTabData.errorMessage}</p>
                  </div>
                </div>
              ) : activeTabData.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <IconLoader2 className="w-8 h-8 text-[#58a6ff] animate-spin mx-auto mb-4" />
                    <p className="text-sm text-[#7d8590]">იტვირთება...</p>
                  </div>
                </div>
              ) : (
                <Editor
                  height="100%"
                  language={getMonacoLanguage(activeTabData.name)}
                  value={activeTabData.content || ''}
                  theme="replit-dark"
                  onChange={(value) => handleEditorChange(value, activeTabData.id)}
                  onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, activeTabData.id)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 21,
                    fontFamily: 'JetBrains Mono, Monaco, monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    bracketPairColorization: { enabled: true },
                    guides: {
                      bracketPairs: true,
                      indentation: true
                    }
                  }}
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};