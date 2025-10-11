export interface PreviewFile {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  lastModified: string;
  timestamp: number;
}

export interface FilePreviewContextType {
  currentPreview: string | null;
  isPreviewOpen: boolean;
  previewHistory: string[];
  isLoading: boolean;
  error: string | null;
  openPreview: (filePath: string) => Promise<void>;
  closePreview: () => void;
  clearCache: () => void;
  cacheSize: number;
  getCachedFile: (filePath: string) => PreviewFile | null;
}
