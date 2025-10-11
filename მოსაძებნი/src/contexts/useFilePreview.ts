import { useContext } from 'react';
import { FilePreviewContext } from './FilePreviewContextObject';

export const useFilePreview = () => {
  const context = useContext(FilePreviewContext);
  if (!context) {
    throw new Error('useFilePreview must be used within a FilePreviewProvider');
  }
  return context;
};
