import { createContext } from 'react';
import type { FilePreviewContextType } from './FilePreviewContext.types';

export const FilePreviewContext = createContext<FilePreviewContextType | null>(null);
