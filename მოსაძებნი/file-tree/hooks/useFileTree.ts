import { useFileTreeCore } from './useFileTreeCore';
import type { FileTreeProps } from '../types';

/**
 * Main FileTree Hook - Clean Interface for File Management
 * 
 * Replaces the massive 584-line useFileTree.ts with clean modular approach
 */
export const useFileTree = (props?: FileTreeProps) => {
  return useFileTreeCore(props);
};

export default useFileTree;