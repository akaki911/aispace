
// File Tree Types - Modular Type Definitions

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: FileNode[];
}

export interface Tab {
  id: string;
  name: string;
  path: string;
  content?: string;
  language?: string;
  hasUnsavedChanges: boolean;
}

export interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  path: string;
  type: 'file' | 'directory';
}

export interface NewFileModal {
  isOpen: boolean;
  type: 'file' | 'folder';
  parentPath: string;
}

export interface FileTreeProps {
  className?: string;
  onFileSelect?: (path: string) => void;
  onFileOpen?: (path: string) => void;
}

// Re-export from main types for compatibility
export type { FileTreeProps as FileTreePropsCompat } from '../../types/fileTree';
