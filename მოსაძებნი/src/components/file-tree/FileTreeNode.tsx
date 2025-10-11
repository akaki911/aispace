
import React, { useCallback } from 'react';
import {
  IconChevronRight,
  IconChevronDown,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconFileText,
  IconPhoto,
  IconFileCode,
  IconSettings,
  IconTerminal,
  IconDatabase,
  IconBrandReact,
  IconBrandJavascript,
  IconBrandTypescript,
  IconFileCode2,
  IconJson,
  IconMarkdown,
  IconPackage,
} from '@tabler/icons-react';
import classNames from 'classnames';
import { FileNode } from '../../types/fileTree';
import { isGeorgianText } from '../../utils/fileTreeUtils';

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  expandedFolders: Set<string>;
  selectedFile: string | null;
  onToggle: (path: string, node?: FileNode) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'directory') => void;
  onDoubleClick?: (path: string) => void;
}

// Enhanced file icon system
const getFileIcon = (fileName: string, isDirectory?: boolean) => {
  if (isDirectory) {
    return null;
  }

  const ext = fileName.toLowerCase().split('.').pop() || '';
  const fullName = fileName.toLowerCase();

  // Georgian files support
  if (isGeorgianText(fileName)) {
    return <IconFileText className="w-4 h-4 text-blue-400" />;
  }

  if (fullName === 'package.json' || fullName === 'package-lock.json') {
    return <IconPackage className="w-4 h-4 text-green-500" />;
  }

  if (fullName.includes('.env')) {
    return <IconSettings className="w-4 h-4 text-yellow-500" />;
  }

  if (fullName === 'tsconfig.json' || fullName === 'vite.config.mts') {
    return <IconSettings className="w-4 h-4 text-blue-500" />;
  }

  if (fullName === 'readme.md' || fullName === 'readme.txt') {
    return <IconFileText className="w-4 h-4 text-blue-400" />;
  }

  switch (ext) {
    case 'tsx':
      return <IconBrandReact className="w-4 h-4 text-cyan-400" />;
    case 'jsx':
      return <IconBrandReact className="w-4 h-4 text-blue-400" />;
    case 'ts':
      return <IconBrandTypescript className="w-4 h-4 text-blue-600" />;
    case 'js':
      return <IconBrandJavascript className="w-4 h-4 text-yellow-500" />;
    case 'json':
      return <IconJson className="w-4 h-4 text-orange-500" />;
    case 'md':
      return <IconMarkdown className="w-4 h-4 text-gray-300" />;
    case 'txt':
      return <IconFileText className="w-4 h-4 text-gray-400" />;
    case 'sh':
    case 'bash':
      return <IconTerminal className="w-4 h-4 text-green-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <IconPhoto className="w-4 h-4 text-pink-500" />;
    case 'sql':
      return <IconDatabase className="w-4 h-4 text-blue-600" />;
    case 'css':
      return <IconFileCode2 className="w-4 h-4 text-purple-500" />;
    case 'html':
      return <IconFileCode className="w-4 h-4 text-orange-600" />;
    case 'py':
      return <IconFileCode className="w-4 h-4 text-blue-500" />;
    default:
      return <IconFile className="w-4 h-4 text-gray-400" />;
  }
};

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  level,
  isExpanded,
  isSelected,
  expandedFolders,
  selectedFile,
  onToggle,
  onSelect,
  onContextMenu,
  onDoubleClick
}) => {
  if (!node || typeof node !== 'object') {
    return null;
  }

  // Validate props
  if (!node || !node.name || !node.path) {
    console.warn('⚠️ Invalid FileTreeNode props:', { node, level, isExpanded });
    return null;
  }

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'directory') {
      onToggle(node.path, node);
    } else {
      onSelect(node.path);
    }
  }, [node, onToggle, onSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'file' && onDoubleClick) {
      onDoubleClick(node.path);
    }
  }, [node.path, node.type, onDoubleClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.path, node.type);
  }, [node.path, node.type, onContextMenu]);

  if (node.type === 'directory') {
    return (
      <div key={node.path} className="select-none">
        <div
          className={classNames(
            'flex items-center p-1 rounded cursor-pointer transition-colors group',
            'hover:bg-[#21262d]',
            isSelected && 'bg-[#1f6feb] hover:bg-[#1f6feb]'
          )}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <div className="flex items-center space-x-1 min-w-0 flex-1">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <IconChevronDown className="w-4 h-4 text-[#7d8590]" />
              ) : (
                <IconChevronRight className="w-4 h-4 text-[#7d8590]" />
              )}
            </div>
            <div className="flex-shrink-0">
              {isExpanded ? (
                <IconFolderOpen className="w-4 h-4 text-[#7d8590]" />
              ) : (
                <IconFolder className="w-4 h-4 text-[#7d8590]" />
              )}
            </div>
            <span className="text-sm text-[#e6edf3] break-words min-w-0 flex-1">
              {node.name}
            </span>
          </div>
        </div>

        {/* Only render children if expanded AND has children */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => {
              const childIsExpanded = expandedFolders.has(child.path);
              const childIsSelected = selectedFile === child.path;
              return (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  level={level + 1}
                  isExpanded={childIsExpanded}
                  isSelected={childIsSelected}
                  expandedFolders={expandedFolders}
                  selectedFile={selectedFile}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onContextMenu={onContextMenu}
                  onDoubleClick={onDoubleClick}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // File node
  return (
    <div
      key={node.path}
      className={classNames(
        'flex items-center p-1 rounded cursor-pointer transition-colors group',
        'hover:bg-[#21262d]',
        isSelected && 'bg-[#1f6feb] hover:bg-[#1f6feb]'
      )}
      style={{ paddingLeft: `${24 + level * 16}px` }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <div className="flex-shrink-0">
          {getFileIcon(node.name, false)}
        </div>
        <span className="text-sm text-[#e6edf3] break-words min-w-0 flex-1">
          {node.name}
        </span>
        {node.size && (
          <span className="text-xs text-[#7d8590] flex-shrink-0">
            {(node.size / 1024).toFixed(1)}KB
          </span>
        )}
      </div>
    </div>
  );
};
