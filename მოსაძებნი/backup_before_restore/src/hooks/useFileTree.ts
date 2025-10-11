import { useState, useEffect, useCallback, useRef } from 'react';
import { FileNode, Tab, ContextMenu, NewFileModal } from '../types/fileTree';
import { validateAndTransformNode, STORAGE_KEYS } from '../utils/fileTreeUtils';

export const useFileTree = () => {
  // Core state
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestInProgress, setRequestInProgress] = useState(false);

  // UI state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ 
    x: 0, y: 0, path: '', type: 'file', visible: false 
  });
  const [newFileModal, setNewFileModal] = useState<NewFileModal>({ 
    isOpen: false, type: 'file' 
  });

  // Tab management
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loadingTabs, setLoadingTabs] = useState<Set<string>>(new Set());
  const [savingTabs, setSavingTabs] = useState<Set<string>>(new Set());
  const [savedTabs, setSavedTabs] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload/Download
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Additional UI state
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persistent state from localStorage - only once on mount
  useEffect(() => {
    const loadStoredState = () => {
      try {
        const savedExpanded = localStorage.getItem(STORAGE_KEYS.EXPANDED_FOLDERS);
        if (savedExpanded) {
          const expandedArray = JSON.parse(savedExpanded);
          if (Array.isArray(expandedArray)) {
            setExpandedFolders(new Set(expandedArray));
          }
        }

        const savedTabs = localStorage.getItem(STORAGE_KEYS.OPEN_TABS);
        if (savedTabs) {
          const tabsArray = JSON.parse(savedTabs);
          if (Array.isArray(tabsArray)) {
            setOpenTabs(tabsArray);
          }
        }

        const savedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
        if (savedActiveTab) {
          setActiveTab(savedActiveTab);
        }
      } catch (e) {
        console.warn('Failed to load FileTree state from localStorage:', e);
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
      }
    };

    loadStoredState();
  }, []); // Empty dependency array - run only once

  // Debounced save to localStorage
  const debouncedSave = useCallback((key: string, value: any) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }, 300);
  }, []);

  // Save state to localStorage with debouncing
  useEffect(() => {
    const expandedArray = Array.from(expandedFolders);
    debouncedSave(STORAGE_KEYS.EXPANDED_FOLDERS, expandedArray);
  }, [expandedFolders, debouncedSave]);

  useEffect(() => {
    debouncedSave(STORAGE_KEYS.OPEN_TABS, openTabs);
  }, [openTabs, debouncedSave]);

  useEffect(() => {
    if (activeTab) {
      debouncedSave(STORAGE_KEYS.ACTIVE_TAB, activeTab);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
    }
  }, [activeTab, debouncedSave]);

  // Load file tree with rate limiting and caching protection
  const loadFileTree = useCallback(async () => {
    if (requestInProgress) {
      console.warn('📂 FileTree: Request already in progress, skipping');
      return;
    }

    try {
      setRequestInProgress(true);
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('/api/files/tree', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json; charset=utf-8',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (controller.signal.aborted) {
        throw new Error('Request aborted');
      }

      let processedTree: FileNode[] = [];

      if (data.success && data.tree) {
        processedTree = data.tree.map(validateAndTransformNode).filter((node: FileNode | null): node is FileNode => node !== null);
        console.log('✅ File tree loaded successfully:', data.itemCount || 'unknown count');

        // Cache successful response
        localStorage.setItem('fileTree-cache', JSON.stringify(processedTree));
        localStorage.setItem('fileTree-timestamp', Date.now().toString());
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.files)) {
          processedTree = data.files.map(validateAndTransformNode).filter((node: FileNode | null): node is FileNode => node !== null);
        } else if (Array.isArray(data.data)) {
          processedTree = data.data.map(validateAndTransformNode).filter((node: FileNode | null): node is FileNode => node !== null);
        } else if (data.success && Array.isArray(data.tree)) {
          processedTree = data.tree.map(validateAndTransformNode).filter((node: FileNode | null): node is FileNode => node !== null);
        }
      } else {
        throw new Error('Invalid file tree data received');
      }

      setFileTree(processedTree);

    } catch (err: any) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
        setError('Request timed out or was aborted.');
        return;
      }

      console.error('❌ Failed to load file tree:', err);
      setError(err.message);

      // Try to load from cache first
      const cachedTree = localStorage.getItem('fileTree-cache');
      const cacheTimestamp = localStorage.getItem('fileTree-timestamp');
      const isCacheValid = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 300000; // 5 minutes

      if (cachedTree && isCacheValid) {
        try {
          setFileTree(JSON.parse(cachedTree));
          console.log('📱 Loaded file tree from cache');
          return;
        } catch (parseError) {
          console.error('❌ Failed to parse cached file tree:', parseError);
        }
      }

      // Set fallback file tree structure
      setFileTree([
        {
          name: 'workspace',
          path: 'workspace',
          type: 'directory',
          children: [
            {
              name: 'src',
              path: 'workspace/src',
              type: 'directory',
              children: [
                { name: 'components', path: 'workspace/src/components', type: 'directory', children: [] },
                { name: 'pages', path: 'workspace/src/pages', type: 'directory', children: [] },
                { name: 'hooks', path: 'workspace/src/hooks', type: 'directory', children: [] }
              ]
            }
          ]
        }
      ]);
    } finally {
      setLoading(false);
      setRequestInProgress(false);
    }
  }, []);

  // Context menu handlers
  const showContextMenu = useCallback((x: number, y: number, path: string, type: 'file' | 'directory') => {
    setContextMenu({ x, y, path, type, visible: true });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Modal handlers
  const openNewFileModal = useCallback((type: 'file' | 'folder', parentPath?: string) => {
    setNewFileModal({ isOpen: true, type, parentPath });
  }, []);

  const closeNewFileModal = useCallback(() => {
    setNewFileModal({ isOpen: false, type: 'file' });
  }, []);

  // Folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Tab management
  const openTab = useCallback((tab: Omit<Tab, 'id'>) => {
    const tabId = `tab-${tab.path}`;
    const newTab: Tab = { ...tab, id: tabId };

    setOpenTabs(prev => {
      const existingIndex = prev.findIndex(t => t.path === tab.path);
      if (existingIndex >= 0) {
        return prev.map((t, i) => i === existingIndex ? newTab : t);
      }
      return [...prev, newTab];
    });

    setActiveTab(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    setActiveTab(prev => {
      if (prev === tabId) {
        const remainingTabs = openTabs.filter(tab => tab.id !== tabId);
        return remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null;
      }
      return prev;
    });
  }, [openTabs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort('Component unmounting');
        } catch (err) {
          // Ignore abort errors during cleanup
        }
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Core state
    fileTree,
    loading,
    error,
    requestInProgress,

    // UI state
    expandedFolders,
    selectedFile,
    setSelectedFile,
    contextMenu,
    newFileModal,

    // Tab state
    openTabs,
    setOpenTabs,
    activeTab,
    setActiveTab,
    loadingTabs,
    setLoadingTabs,
    savingTabs,
    setSavingTabs,
    savedTabs,
    setSavedTabs,

    // Search
    searchQuery,
    setSearchQuery,

    // Upload/Download
    dragOver,
    setDragOver,
    uploading,
    setUploading,
    isDownloading,
    setIsDownloading,

    // Additional UI
    copiedToClipboard,
    setCopiedToClipboard,

    // Actions
    loadFileTree,
    showContextMenu,
    hideContextMenu,
    openNewFileModal,
    closeNewFileModal,
    toggleFolder,
    openTab,
    closeTab,

    // Refs
    abortControllerRef
  };
};