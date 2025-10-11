import React, { useMemo } from 'react';
import { IconSearch, IconX, IconWand } from '@tabler/icons-react';
import classNames from 'classnames';
import { FileNode } from '../../types/fileTree';
import { sortAndGroupNodes } from '../../utils/fileTreeUtils';

interface FileSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  fileTree: FileNode[];
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (show: boolean) => void;
}

export const FileSearch: React.FC<FileSearchProps> = ({
  searchQuery,
  setSearchQuery,
  fileTree,
  showAdvancedSearch,
  setShowAdvancedSearch
}) => {
  // Enhanced file filtering with direct file matching
  const filteredFileTree = useMemo(() => {
    const safeFileTree = Array.isArray(fileTree) ? fileTree : [];

    if (!searchQuery.trim()) {
      return sortAndGroupNodes(safeFileTree);
    }

    const query = searchQuery.toLowerCase();
    const matchedFiles: FileNode[] = [];

    // Recursively find all matching files
    const findMatchingFiles = (nodes: FileNode[], parentPath: string = '') => {
      if (!Array.isArray(nodes)) return;

      nodes.forEach(node => {
        if (!node || typeof node !== 'object') return;

        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

        if (node.type === 'file') {
          // Check if file name or full path contains search query
          if (node.name?.toLowerCase().includes(query) || currentPath.toLowerCase().includes(query)) {
            matchedFiles.push({
              ...node,
              path: node.path || currentPath // Ensure path is available for display
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
      // Files with exact name matches first
      const aExactMatch = a.name?.toLowerCase() === query;
      const bExactMatch = b.name?.toLowerCase() === query;

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Then by name similarity
      return a.name?.localeCompare(b.name || '') || 0;
    });
  }, [fileTree, searchQuery]);

  return (
    <div className="border-b border-[#21262d] p-3">
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <IconSearch className="h-4 w-4 text-[#7d8590]" />
        </div>
        <input
          id="file-search-input"
          type="text"
          placeholder="ფაილების ძებნა... (Ctrl+P)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={classNames(
            'w-full pl-9 pr-9 py-2 text-sm',
            'bg-[#0d1117] border border-[#30363d] rounded',
            'text-[#e6edf3] placeholder-[#7d8590]',
            'focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:border-transparent',
            'transition-all duration-200'
          )}
          autoComplete="off"
        />
        
        <div className="absolute inset-y-0 right-1 flex items-center space-x-1">
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] transition-colors"
              title="გასუფთავება"
            >
              <IconX className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={classNames(
              'p-1 transition-colors rounded',
              showAdvancedSearch 
                ? 'text-[#58a6ff] bg-[#58a6ff]/10' 
                : 'text-[#7d8590] hover:text-[#e6edf3]'
            )}
            title="გაფართოებული ძებნა"
          >
            <IconWand className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Search Results Count */}
      {searchQuery && (
        <div className="mt-2 text-xs text-[#7d8590]">
          ნაპოვნია {filteredFileTree.length} ფაილი
        </div>
      )}
    </div>
  );
};