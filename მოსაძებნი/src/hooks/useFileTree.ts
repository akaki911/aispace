// DEPRECATED: This file has been moved to modular architecture
// Please use: import { useFileTree } from '../features/file-tree/hooks/useFileTree';
import { useFileTree as useModularFileTree } from '../features/file-tree/hooks/useFileTree';

export const useFileTree = useModularFileTree;

// This implementation has been moved to modular architecture
// All code is now in src/features/file-tree/ for better maintainability