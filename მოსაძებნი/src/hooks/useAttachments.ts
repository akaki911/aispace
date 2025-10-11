import { useState, useCallback } from 'react';

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  path: string;
  url: string;
  contentType: string;
}

const createPreviewUrl = async (path: string): Promise<string> => {
  const encoded = encodeURIComponent(path);
  const response = await fetch(`/api/files/content/${encoded}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to load uploaded file (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const useAttachments = () => {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      const pendingFiles = Array.from(files);
      pendingFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text().catch(() => 'Upload failed');
        throw new Error(message || 'Upload failed');
      }

      const payload = await response.json();
      const uploaded = Array.isArray(payload?.data) ? payload.data : [];

      const prepared = await Promise.all(
        uploaded.map(async (item: any, index: number): Promise<AttachmentItem> => {
          const original = pendingFiles[index];
          const path = typeof item?.path === 'string' ? item.path : String(item?.path || '');
          if (!path) {
            throw new Error('Upload response missing file path');
          }

          const previewUrl = await createPreviewUrl(path);

          return {
            id: path,
            name: original?.name || path.split('/').pop() || 'file',
            size: Number(item?.size ?? original?.size ?? 0),
            mime: original?.type || item?.contentType || 'application/octet-stream',
            path,
            url: previewUrl,
            contentType: item?.contentType || original?.type || 'application/octet-stream',
          };
        }),
      );

      setAttachments((prev) => [...prev, ...prepared]);
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((item) => {
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
      return [];
    });
  }, []);

  return {
    attachments,
    uploading,
    uploadFiles,
    removeAttachment,
    clearAttachments
  };
};