// @ts-nocheck
import React, { useEffect, useMemo, useCallback } from 'react';
import classNames from 'classnames';
import { useFileTree } from '../../hooks/useFileTree';
import { FileTreeProps, FileNode } from '../../types/fileTree';
import { sortAndGroupNodes } from '../../utils/fileTreeUtils';
import { FileSearch } from './FileSearch';
import { FileOperations } from './FileOperations';
import { FileTreeNode } from './FileTreeNode';
import { TabManager } from './TabManager';
import AdvancedSearch from '../AdvancedSearch';

export const FileTreeCore: React.FC<FileTreeProps> = ({ className }) => {
  const {
    // Core state
    fileTree,
    loading,
    error,

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
    isDownloading,
    setIsDownloading,

    // Additional UI
    copiedToClipboard,
    setCopiedToClipboard,

    // Lazy loading state
    loadingFolders,

    // Actions
    loadFileTree,
    showContextMenu,
    hideContextMenu,
    openNewFileModal,
    closeNewFileModal,
    toggleFolder,
    openTab,
    closeTab,
    loadTabContent, // ✅ Added missing loadTabContent
  } = useFileTree();

  // Advanced search state
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState(false);

  // Load file tree on mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadFileTree();
    }, 100);

    const refreshInterval = setInterval(loadFileTree, 60000); // Refresh every minute

    return () => {
      clearTimeout(timeoutId);
      clearInterval(refreshInterval);
    };
  }, [loadFileTree]);


  // Enhanced file filtering with direct file matching
  const filteredFileTree = useMemo(() => {
    const safeFileTree = Array.isArray(fileTree) ? fileTree : [];

    if (!searchQuery.trim()) {
      return sortAndGroupNodes(safeFileTree);
    }

    const query = searchQuery.toLowerCase();
    const matchedFiles: FileNode[] = [];

    // Recursively find all matching files
    const findMatchingFiles = (nodes: FileNode[], parentPath = '') => {
      if (!Array.isArray(nodes)) return;

      nodes.forEach(node => {
        if (!node || typeof node !== 'object') return;

        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

        if (node.type === 'file') {
          // Check if file name or full path contains search query
          if (node.name?.toLowerCase().includes(query) || currentPath.toLowerCase().includes(query)) {
            matchedFiles.push({
              ...node,
              path: node.path || currentPath
            });
          }
        } else if (node.children && Array.isArray(node.children)) {
          // Recursively search in subdirectories
          findMatchingFiles(node.children, currentPath);
        }
      });
    };

    findMatchingFiles(safeFileTree);

    // Return matched files sorted by relevance
    return matchedFiles.sort((a, b) => {
      const aExactMatch = a.name?.toLowerCase() === query;
      const bExactMatch = b.name?.toLowerCase() === query;

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      return a.name?.localeCompare(b.name || '') || 0;
    });
  }, [fileTree, searchQuery]);

  // Handle file selection and opening
  const handleFileSelect = useCallback((path: string) => {
    console.log('🔍 FileTreeCore: handleFileSelect triggered for path:', path);
    setSelectedFile(path);

    // Single click to open files
    const findFileNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
      for (const node of nodes) {
        if (node.path === targetPath) return node;
        if (node.children) {
          const found = findFileNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const fileNode = findFileNode(fileTree, path);
    if (fileNode && fileNode.type === 'file') {
      const extension = fileNode.name.split('.').pop()?.toLowerCase();
      const isBinary = fileNode.path.startsWith('uploads/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'pdf', 'zip', 'mp4', 'mp3', 'wav'].includes(extension || '');
      const newTab = {
        id: `file-${fileNode.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: fileNode.name,
        path: fileNode.path,
        language: fileNode.name.split('.').pop()?.toLowerCase(),
        hasUnsavedChanges: false,
        isBinary
      };

      openTab(newTab);

      // Load content immediately after opening tab
      if (loadTabContent) {
        loadTabContent(newTab);
      }
    }
  }, [setSelectedFile, fileTree, openTab, loadTabContent]);

  const handleFileDoubleClick = useCallback((path: string) => {
    // Find the file node to get its name
    const findFileNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
      for (const node of nodes) {
        if (node.path === targetPath) return node;
        if (node.children) {
          const found = findFileNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const fileNode = findFileNode(fileTree, path);
    if (fileNode && fileNode.type === 'file') {
      const extension = fileNode.name.split('.').pop()?.toLowerCase();
      const isBinary = fileNode.path.startsWith('uploads/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'pdf', 'zip', 'mp4', 'mp3', 'wav'].includes(extension || '');
      const newTab = {
        id: `file-${fileNode.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: fileNode.name,
        path: fileNode.path,
        language: fileNode.name.split('.').pop()?.toLowerCase(),
        hasUnsavedChanges: false,
        isBinary
      };

      openTab(newTab);

      // Load content immediately after opening tab
      if (loadTabContent) {
        loadTabContent(newTab);
      }
    }
  }, [fileTree, openTab, loadTabContent]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, type: 'file' | 'directory') => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, path, type);
  }, [showContextMenu]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, [setDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, [setDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.files.length > 0) {
      // Handle file upload - this would need to be implemented
      console.log('Files dropped:', e.dataTransfer.files);
    }
  }, [setDragOver]);

  // Click outside handler for context menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        hideContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible, hideContextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('#file-search-input')?.focus();
      }

      if (e.key === 'Escape') {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [setSearchQuery]);

  if (loading) {
    return (
      <div className={classNames('h-full flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#7d8590]">იტვირთება ფაილების სია...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames('h-full flex', className)}>
      {/* Left Panel - File Tree */}
      <div className="min-w-80 w-96 max-w-2xl bg-[#0d1117] border-r border-[#21262d] flex flex-col h-full min-h-0 relative z-10 resize-x">
        {/* Search */}
        <div className="flex-shrink-0">
          <FileSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            fileTree={fileTree}
            showAdvancedSearch={showAdvancedSearch}
            setShowAdvancedSearch={setShowAdvancedSearch}
          />
        </div>

        {/* File Operations */}
        <div className="flex-shrink-0">
          <FileOperations
            fileTree={fileTree}
            contextMenu={contextMenu}
            hideContextMenu={hideContextMenu}
            newFileModal={newFileModal}
            openNewFileModal={openNewFileModal}
            closeNewFileModal={closeNewFileModal}
            copiedToClipboard={copiedToClipboard}
            setCopiedToClipboard={setCopiedToClipboard}
            isDownloading={isDownloading}
            setIsDownloading={setIsDownloading}
            setError={(error) => console.error(error)}
            loadFileTree={loadFileTree}
          />
        </div>

        {/* File Tree - Main scrollable area */}
        <div
          className={classNames(
            'flex-1 overflow-auto min-h-0',
            dragOver && 'bg-[#1f6feb]/10 border-2 border-dashed border-[#58a6ff]'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {error ? (
            <div className="p-4 text-center">
              <p className="text-red-400 text-sm mb-2">შეცდომა:</p>
              <p className="text-[#7d8590] text-xs">{error}</p>
              <button
                onClick={loadFileTree}
                className="mt-2 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] px-2 py-1 rounded transition-colors"
              >
                ხელახლა ცდა
              </button>
            </div>
          ) : filteredFileTree.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[#7d8590] text-sm">
                {searchQuery ? 'ფაილები ვერ მოიძებნა' : 'ფაილები არ არის'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredFileTree.map((node) => {
                if (!node || !node.path) {
                  console.warn('⚠️ Skipping invalid node:', node);
                  return null;
                }
                return (
                  <FileTreeNode
                    key={node.path || `node-${Math.random()}`}
                    node={node}
                    level={0}
                    isExpanded={expandedFolders.has(node.path)}
                    isSelected={selectedFile === node.path}
                    expandedFolders={expandedFolders}
                    selectedFile={selectedFile}
                    onToggle={toggleFolder}
                    onSelect={handleFileSelect}
                    onContextMenu={handleContextMenu}
                    onDoubleClick={handleFileDoubleClick}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Tab Manager */}
      <div className="flex-1 h-full min-w-0">
        <TabManager
          openTabs={openTabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          closeTab={closeTab}
          savingTabs={savingTabs}
          setSavingTabs={setSavingTabs}
          savedTabs={savedTabs}
          setSavedTabs={setSavedTabs}
          copiedToClipboard={copiedToClipboard}
          setCopiedToClipboard={setCopiedToClipboard}
          loadingTabs={loadingTabs}
          setLoadingTabs={setLoadingTabs}
          setOpenTabs={setOpenTabs}
        />
      </div>

      {/* Advanced Search Modal */}
      {showAdvancedSearch && (
        <AdvancedSearch
          onFileSelect={(filePath) => {
            setSearchQuery('');
            setShowAdvancedSearch(false);
            handleFileSelect(filePath);
          }}
        />
      )}
    </div>
  );
};