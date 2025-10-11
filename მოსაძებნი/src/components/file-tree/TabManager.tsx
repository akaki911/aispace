
import React, { useCallback, useRef } from 'react';
import { IconX, IconLoader2, IconAlertTriangle, IconCopy, IconCheck } from '@tabler/icons-react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import classNames from 'classnames';
import { Tab } from '../../types/fileTree';
import { getMonacoLanguage } from '../../utils/fileTreeUtils';

const STORAGE_PREFIX = 'uploads/';
const TEXT_FILE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'scss', 'sass', 'html', 'txt']);
const BINARY_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'pdf', 'zip', 'mp4', 'mp3', 'wav']);

const getExtension = (filePath: string): string => {
  const parts = filePath.split('.');
  if (parts.length <= 1) {
    return '';
  }
  return (parts.pop() || '').toLowerCase();
};

const isBinaryPath = (filePath: string): boolean => {
  const ext = getExtension(filePath);
  return filePath.startsWith(STORAGE_PREFIX) || (ext ? BINARY_FILE_EXTENSIONS.has(ext) : false);
};

const isTextPath = (filePath: string): boolean => {
  if (filePath.startsWith(STORAGE_PREFIX)) {
    return false;
  }

  const ext = getExtension(filePath);
  if (!ext) {
    return true;
  }

  if (BINARY_FILE_EXTENSIONS.has(ext)) {
    return false;
  }

  return true;
};

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
  loadingTabs: Set<string>;
  setLoadingTabs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setOpenTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
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
  loadingTabs,
  setLoadingTabs,
  setOpenTabs
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Get active tab data FIRST
  const activeTabData = openTabs.find(tab => tab.id === activeTab);

  // Enhanced file loading with timeout and better error handling
  const loadFileContent = useCallback(async (tab: Tab) => {
    if (!tab.path) return;

    let abortController: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      console.log(`📂 Loading file: ${tab.path}`);
      setLoadingTabs(prev => new Set([...prev, tab.path]));

      // Create abort controller for timeout
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
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
        credentials: 'include',
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const binary = tab.isBinary ?? isBinaryPath(tab.path);

      if (binary) {
        const blob = await response.blob();
        const binaryUrl = URL.createObjectURL(blob);
        const contentType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream';

        console.log(`✅ Binary file loaded successfully: ${tab.path} (${blob.size} bytes)`);

        setOpenTabs(prev => prev.map(t => {
          if (t.path !== tab.path) {
            return t;
          }

          if (t.binaryUrl && t.binaryUrl.startsWith('blob:')) {
            URL.revokeObjectURL(t.binaryUrl);
          }

          return {
            ...t,
            content: undefined,
            binaryUrl,
            contentType,
            size: blob.size,
            isBinary: true,
            isLoading: false,
            hasError: false,
          };
        }));
      } else {
        const content = await response.text();
        const contentType = response.headers.get('Content-Type') || 'text/plain';
        console.log(`✅ File loaded successfully: ${tab.path} (${content.length} chars)`);

        setOpenTabs(prev => prev.map(t =>
          t.path === tab.path
            ? { ...t, content, binaryUrl: undefined, contentType, isBinary: false, isLoading: false, hasError: false }
            : t
        ));
      }

    } catch (error) {
      console.error(`❌ Failed to load file ${tab.path}:`, error);
      const err = error instanceof Error ? error : new Error(String(error));

      let errorMessage = 'ფაილის ჩატვირთვა ვერ მოხერხდა';

      if (err.name === 'AbortError') {
        errorMessage = 'ფაილის ჩატვირთვა ჩაიყოლა (timeout)';
      } else if (err.message?.includes('404')) {
        errorMessage = 'ფაილი ვერ მოიძებნა';
      } else if (err.message?.includes('403')) {
        errorMessage = 'ფაილზე წვდომა აიკრძალა';
      } else if (err.message?.includes('500')) {
        errorMessage = 'სერვერის შეცდომა';
      } else if (err.message) {
        errorMessage = `შეცდომა: ${err.message}`;
      }

      setOpenTabs(prev => prev.map(t =>
        t.path === tab.path
          ? {
              ...t,
              content: `# ❌ ${errorMessage}\n\n\`\`\`\nPath: ${tab.path}\nError: ${err.message}\nTime: ${new Date().toLocaleString('ka-GE')}\n\`\`\`\n\n**შემოწმების ქმედებები:**\n- გადატვირთეთ ფაილი (Ctrl+R)\n- შეამოწმეთ ფაილის გზა\n- დარწმუნდით რომ ფაილი არსებობს`,
              binaryUrl: undefined,
              isBinary: tab.isBinary,
              isLoading: false,
              hasError: true,
              errorMessage
            }
          : t
      ));
    } finally {
      // Clear timeout to prevent memory leaks
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

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

  // Save file content
  const saveFileContent = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    if (isBinaryPath(filePath)) {
      setOpenTabs(prev => prev.map(tab =>
        tab.path === filePath
          ? {
              ...tab,
              hasError: true,
              errorMessage: 'Binary files must be uploaded via Storage.',
              isBinary: true,
            }
          : tab
      ));
      return false;
    }

    try {
      const tabId = `tab-${filePath}`;
      setSavingTabs(prev => new Set([...prev, tabId]));

      console.log('💾 Saving file content for:', filePath);

      const response = await fetch('/api/files/save', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          content,
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('💾 File save error:', response.status, errorText);
        throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          lastModified?: string;
        };
      };

      console.log('✅ File saved successfully:', filePath);

      setOpenTabs(prev => prev.map(tab =>
        tab.path === filePath
          ? {
              ...tab,
              hasUnsavedChanges: false,
              lastModified: payload?.data?.lastModified ?? tab.lastModified,
            }
          : tab
      ));

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

    } catch (err) {
      console.error('💾 Failed to save file content:', err);
      return false;
    } finally {
      setSavingTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(`tab-${filePath}`);
        return newSet;
      });
    }
  }, [setOpenTabs, setSavingTabs, setSavedTabs]);

  // Handle editor content changes
  const handleEditorChange = useCallback((value: string | undefined, tabId: string) => {
    if (!tabId || value === undefined) return;

    setOpenTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) {
        return tab;
      }

      if (tab.isBinary) {
        return tab;
      }

      console.log('Editor content changed for tab:', tabId, 'Length:', value.length);
      return { ...tab, content: value, hasUnsavedChanges: true };
    }));
  }, [setOpenTabs]);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco, tabId: string) => {
    editorRef.current = editor;

    const currentTab = openTabs.find(t => t.id === tabId);
    if (currentTab?.isBinary) {
      return;
    }

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

    // Set initial content if available
    if (currentTab?.content && currentTab.content !== editor.getValue()) {
      console.log(`🎯 Setting initial content for ${currentTab.name}: ${currentTab.content.length} chars`);
      editor.setValue(currentTab.content);
    }
  }, [openTabs, savingTabs, saveFileContent]);

  // Force reload functionality
  const forceReload = useCallback(() => {
    if (!activeTabData) return;

    console.log(`🔄 Force reloading tab: ${activeTabData.name}`);
    setOpenTabs(prev =>
      prev.map(tab => {
        if (tab.id !== activeTab) {
          return tab;
        }

        if (tab.binaryUrl && tab.binaryUrl.startsWith('blob:')) {
          URL.revokeObjectURL(tab.binaryUrl);
        }

        return { ...tab, content: undefined, binaryUrl: undefined, isLoading: false, hasError: false, errorMessage: undefined };
      })
    );

    // Trigger reload after state update
    setTimeout(() => {
      const tab = openTabs.find(t => t.id === activeTab);
      if (tab) {
        loadFileContent(tab);
      }
    }, 100);
  }, [activeTabData, activeTab, setOpenTabs, openTabs, loadFileContent]);

  // JSON validation helper
  const validateJSON = useCallback((content: string, fileName: string) => {
    if (!fileName.endsWith('.json')) return { isValid: true, error: null };

    try {
      JSON.parse(content);
      console.log(`✅ Valid JSON: ${fileName}`);
      return { isValid: true, error: null };
    } catch (e) {
      console.warn(`⚠️ Invalid JSON in ${fileName}:`, e);
      const message = e instanceof Error ? e.message : String(e);
      return { isValid: false, error: message };
    }
  }, []);

  // Sync content changes with Monaco Editor
  React.useEffect(() => {
    const content = activeTabData?.content;
    const name = activeTabData?.name;

    if (!content || content === undefined) return;

    // Validate JSON files
    if (name && (name.endsWith('.json'))) {
      const validation = validateJSON(content, name);
      if (!validation.isValid) {
        console.warn(`🔍 JSON validation failed for ${name}: ${validation.error}`);
      }
    }

    let retries = 0;
    const maxRetries = 20;

    const trySync = () => {
      if (editorRef.current) {
        const currentValue = editorRef.current.getValue();
        if (currentValue !== content) {
          console.log(`🔄 Syncing content for ${name}: ${content.length} chars`);
          console.log(`📊 EditorRef status: AVAILABLE (retry #${retries})`);
          editorRef.current.setValue(content);
          editorRef.current.setPosition({ lineNumber: 1, column: 1 });
        }
      } else if (retries < maxRetries) {
        retries++;
        console.log(`⏳ EditorRef not ready yet, retrying in 100ms... (${retries}/${maxRetries})`);
        setTimeout(trySync, 100);
      } else {
        console.warn(`⚠️ EditorRef STILL not available after ${maxRetries} retries for ${name}!`);
        console.warn(`🔍 Debug info: activeTabData exists=${!!activeTabData}, content length=${content.length}`);
      }
    };

    trySync();
  }, [activeTabData?.content, activeTabData?.name, validateJSON]);

  // Copy content to clipboard
  const copyToClipboard = useCallback(() => {
    const activeTabContent = openTabs.find(tab => tab.id === activeTab);
    if (!activeTabContent?.content || activeTabContent.isBinary) return;

    try {
      navigator.clipboard.writeText(activeTabContent.formattedContent || activeTabContent.content);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [activeTab, openTabs, setCopiedToClipboard]);

  const triggerStorageUpload = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>('input[data-file-tree-upload="true"]');
    if (input) {
      input.click();
    } else {
      alert('Use the Upload button in the File Tree to upload via Storage.');
    }
  }, []);

  // Auto-load content for new tabs that are loading
  React.useEffect(() => {
    const tabsNeedingContent = openTabs.filter(tab =>
      tab.content === undefined &&
      !loadingTabs.has(tab.path) &&
      !tab.isLoading &&
      (!tab.isBinary || !tab.binaryUrl)
    );

    tabsNeedingContent.forEach(tab => {
      console.log(`🔄 Auto-loading content for tab: ${tab.name}`);
      loadFileContent(tab);
    });
  }, [openTabs, loadingTabs, loadFileContent]);

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
            {/* Early fallback for undefined content */}
            {activeTabData.content === undefined && !loadingTabs.has(activeTabData.path) && !activeTabData.isLoading && !activeTabData.hasError && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-sm text-gray-400 p-4 mb-4">📂 Content loading...</div>
                  <p className="text-xs text-[#7d8590] mb-4">Path: {activeTabData.path}</p>
                  <button 
                    onClick={forceReload}
                    className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-2 rounded transition-colors"
                  >
                    🔄 ხელახალი ჩატვირთვა
                  </button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {(loadingTabs.has(activeTabData.path) || activeTabData.isLoading) && !activeTabData.hasError && activeTabData.content === undefined && (
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
                        setOpenTabs(prev => prev.map(t => 
                          t.path === activeTabData.path 
                            ? { ...t, isLoading: false, hasError: true, errorMessage: 'ჩატვირთვა გაუქმდა' }
                            : t
                        ));
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
                  className={classNames('transition-colors', activeTabData.isBinary ? 'text-[#38404c] cursor-not-allowed' : 'text-[#7d8590] hover:text-[#e6edf3]')}
                  disabled={Boolean(activeTabData.isBinary)}
                  title="კოპირება"
                >
                  {copiedToClipboard ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                </button>

                <button
                  onClick={forceReload}
                  className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                  title="ხელახალი ჩატვირთვა"
                >
                  🔄
                </button>

                {activeTabData.isBinary ? (
                  <button
                    onClick={triggerStorageUpload}
                    className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-2 py-1 rounded transition-colors"
                  >
                    Upload via Storage
                  </button>
                ) : (
                  activeTabData.hasUnsavedChanges && !savingTabs.has(activeTabData.id) && (
                    <button
                      onClick={() => saveFileContent(activeTabData.path, activeTabData.content || '')}
                      className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-2 py-1 rounded transition-colors"
                    >
                      შენახვა
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0 relative">
              {activeTabData.isBinary ? (
                activeTabData.binaryUrl ? (
                  <div className="flex flex-col items-center justify-start h-full overflow-auto bg-[#0d1117] p-6 gap-4 text-center">
                    <div className="text-sm text-[#e6edf3] font-medium">Binary preview</div>
                    <p className="text-xs text-[#7d8590] max-w-2xl">
                      This file is stored in Firebase Storage. Use the controls below to download or upload a replacement via Storage.
                    </p>
                    {activeTabData.contentType?.startsWith('image/') ? (
                      <img
                        src={activeTabData.binaryUrl}
                        alt={activeTabData.name}
                        className="max-h-[60vh] max-w-full rounded border border-[#21262d]"
                      />
                    ) : activeTabData.contentType === 'application/pdf' ? (
                      <iframe
                        src={activeTabData.binaryUrl}
                        title={activeTabData.name}
                        className="w-full h-[60vh] bg-white rounded border border-[#21262d]"
                      />
                    ) : (
                      <div className="text-xs text-[#7d8590] bg-[#161b22] border border-[#21262d] rounded px-4 py-3 w-full md:w-2/3">
                        Preview not available. Download the file to view it locally.
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                      <a
                        href={`/api/files/content/${encodeURIComponent(activeTabData.path)}`}
                        className="text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-3 py-2 rounded transition-colors"
                        download
                      >
                        ⬇️ Download
                      </a>
                      <button
                        onClick={triggerStorageUpload}
                        className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-2 rounded transition-colors"
                      >
                        Upload via Storage
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-[#e6edf3] mb-2">📂 იტვირთება: {activeTabData.name}</p>
                    <p className="text-xs text-[#7d8590]">Path: {activeTabData.path}</p>
                  </div>
                )
              ) : activeTabData.hasError ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <IconAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#e6edf3] mb-2">ფაილის ჩატვირთვის შეცდომა</h3>
                  <p className="text-sm text-[#7d8590] mb-4">{activeTabData.errorMessage}</p>
                  <button 
                    onClick={() => {
                      console.log(`🔄 Retry loading for ${activeTabData.name}`);
                      setOpenTabs(prev => prev.map(t => 
                        t.path === activeTabData.path 
                          ? { ...t, hasError: false, content: undefined, isLoading: false }
                          : t
                      ));
                      loadFileContent(activeTabData);
                    }}
                    className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-2 rounded transition-colors"
                  >
                    🔄 ხელახალი ცდა
                  </button>
                </div>
              ) : activeTabData.content !== undefined && activeTabData.content !== null && !loadingTabs.has(activeTabData.path) && !activeTabData.isLoading ? (
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
                    wordWrap: activeTabData.name?.endsWith('.md') ? 'on' : 'off',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    bracketPairColorization: { enabled: true },
                    guides: {
                      bracketPairs: true,
                      indentation: true
                    },
                    readOnly: false,
                    tabSize: activeTabData.name?.endsWith('.json') ? 2 : 4,
                    insertSpaces: true,
                    detectIndentation: true,
                    formatOnPaste: activeTabData.name?.endsWith('.json') || activeTabData.name?.endsWith('.ts') || activeTabData.name?.endsWith('.tsx'),
                    formatOnType: activeTabData.name?.endsWith('.json'),
                    lineNumbers: activeTabData.name?.endsWith('.md') ? 'off' : 'on',
                    folding: true,
                    foldingStrategy: 'indentation'
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[#e6edf3] text-sm mb-2">📂 იტვირთება: {activeTabData.name}</p>
                  <p className="text-[#7d8590] text-xs mb-4">Path: {activeTabData.path}</p>
                  <button 
                    onClick={() => {
                      console.log(`🔄 Force reload for tab: ${activeTabData.name}`);
                      setLoadingTabs(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(activeTabData.path);
                        return newSet;
                      });
                      setOpenTabs(prev => prev.map(t => 
                        t.path === activeTabData.path 
                          ? { ...t, content: undefined, isLoading: false, hasError: false }
                          : t
                      ));
                      setTimeout(() => {
                        loadFileContent(activeTabData);
                      }, 100);
                    }}
                    className="text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-3 py-2 rounded transition-colors"
                  >
                    🔄 ხელახალი ცდა
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
