// File Tree Types - Shared across all file tree components
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  lastModified?: string;
  isSystemFile?: boolean;
  isHidden?: boolean;
  category?: 'source' | 'config' | 'packager' | 'system' | 'other';
}

export interface Tab {
  id: string;
  name: string;
  path: string;
  content?: string;
  formattedContent?: string;
  language?: string;
  isActive?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  hasUnsavedChanges?: boolean;
  originalContent?: string;
}

export interface ContextMenu {
  x: number;
  y: number;
  path: string;
  type: 'file' | 'directory';
  visible: boolean;
}

export interface NewFileModal {
  isOpen: boolean;
  type: 'file' | 'folder';
  parentPath?: string;
}

export interface FileTreeProps {
  className?: string;
}

export type FileCategory = 'source' | 'config' | 'packager' | 'system' | 'other';