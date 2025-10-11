import React from 'react';
import { FileTreeCore } from './file-tree/FileTreeCore';
import { FileTreeProps } from '../types/fileTree';

/**
 * FileTree - Modular Georgian File Management System
 * 
 * Previously: 1936+ lines of monolithic code causing:
 * - Performance issues & memory leaks
 * - Bundle size problems
 * - Maintainability nightmares  
 * - Developer experience issues
 * 
 * Now: Clean modular architecture with:
 * - FileTreeCore: Main orchestrator
 * - FileTreeNode: Individual file/folder rendering
 * - FileSearch: Search & filtering functionality  
 * - FileOperations: CRUD operations & context menus
 * - TabManager: Tab management & Monaco editor
 * - useFileTree: Centralized state management
 * - Shared types & utilities
 * 
 * Result: Maintainable, performant, Georgian-enabled file management! 🇬🇪
 */
const FileTree: React.FC<FileTreeProps> = (props) => {
  return <FileTreeCore {...props} />;
};

export default FileTree;