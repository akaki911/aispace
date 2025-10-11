
import { useCallback, useMemo, useState } from 'react';

interface FileTreeItem {
  name: string;
  type: "file" | "directory";
  path: string;
  size: number;
  lastModified: string;
  extension?: string;
  children?: FileTreeItem[];
}

const normalizeApiBase = (): string => {
  const envBase =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) ||
    (typeof process !== 'undefined' ? process.env?.VITE_API_BASE : undefined) ||
    '/api';

  if (!envBase) {
    return '/api';
  }

  return envBase.endsWith('/') ? envBase.slice(0, -1) : envBase;
};

const encodePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const TEXT_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.md']);

const TEXT_MIME_PREFIXES = ['text/', 'application/json'];

const isTextExtension = (path: string): boolean => {
  const lower = path.toLowerCase();
  for (const ext of TEXT_FILE_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
};

const isTextContentType = (contentType: string | null): boolean => {
  if (!contentType) {
    return false;
  }
  return TEXT_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
};

const getBinaryUploadPath = (path?: string | null): string | undefined => {
  if (!path) {
    return undefined;
  }
  const parts = path.split('/');
  if (parts.length <= 1) {
    return undefined;
  }
  return parts.slice(0, -1).join('/');
};

export const useFileOperations = (isAuthenticated: boolean, authUser: any) => {
  const [tree, setTree] = useState<FileTreeItem[] | null>(null);
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
    lastModified: string;
    contentType?: string;
    blobUrl?: string | null;
    size?: number;
    isBinary?: boolean;
  } | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const apiBase = useMemo(() => normalizeApiBase(), []);

  const loadFileTree = useCallback(async () => {
    if (!isAuthenticated || !authUser) {
      console.log("🟡 Skipping file tree loading - not authenticated");
      return;
    }

    try {
      setIsTreeLoading(true);
      console.log("🔍 Loading file tree...");

      const response = await fetch(`${apiBase}/files/tree`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ File tree loaded successfully:", data);
        const treePayload = Array.isArray(data?.data) ? data.data : [];
        setTree(treePayload);
      } else {
        console.error("❌ Failed to load file tree:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Response:", errorText);
        setTree(null);
      }
    } catch (error) {
      console.error("❌ File tree loading error:", error);
      setTree(null);
    } finally {
      setIsTreeLoading(false);
    }
  }, [apiBase, authUser, isAuthenticated]);

  const loadFile = useCallback(async (path: string) => {
    if (!isAuthenticated) throw new Error("Authentication required");

    const response = await fetch(
      `${apiBase}/files/content/${encodePath(path)}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type');
    const isText = isTextContentType(contentType) || isTextExtension(path);

    if (isText) {
      const text = await response.text();
      return { content: text, contentType, blobUrl: null, isBinary: false };
    }

    const blob = await response.blob();
    const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : undefined;
    const sizeHeader = response.headers.get('Content-Length');
    const sizeFromHeader = sizeHeader ? Number.parseInt(sizeHeader, 10) : Number.NaN;

    return {
      content: '',
      contentType: contentType ?? 'application/octet-stream',
      blobUrl: blobUrl ?? null,
      size: Number.isFinite(sizeFromHeader) ? sizeFromHeader : blob.size,
      isBinary: true,
    };
  }, [apiBase, isAuthenticated]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!isAuthenticated) throw new Error("Authentication required");

    if (!isTextExtension(path)) {
      throw new Error('Binary files must be uploaded via Storage.');
    }

    let rollbackSnapshot: typeof currentFile | null = null;
    setCurrentFile(prev => {
      if (prev?.path === path) {
        rollbackSnapshot = prev;
        const updated = { ...prev, content };
        return updated;
      }
      return prev;
    });

    try {
      const response = await fetch(`${apiBase}/files/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json().catch(() => ({ success: true }));

      if (payload?.success === false) {
        throw new Error(payload?.message || 'File save failed');
      }

      return payload;
    } catch (error) {
      if (rollbackSnapshot) {
        setCurrentFile(rollbackSnapshot);
      }
      throw error;
    }
  }, [apiBase, isAuthenticated]);

  const uploadBinaryFile = useCallback(
    async (file: File, targetPath?: string | null) => {
      if (!isAuthenticated) throw new Error('Authentication required');

      if (file.size > 25 * 1024 * 1024) {
        throw new Error('File exceeds 25MB upload limit.');
      }

      const formData = new FormData();
      formData.append('file', file, file.name);

      const subpath = targetPath ?? getBinaryUploadPath(currentFile?.path ?? undefined);
      if (subpath) {
        formData.append('path', subpath);
      }

      const response = await fetch(`${apiBase}/files/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Failed to upload file: ${response.status} ${response.statusText}`);
      }

      return response.json().catch(() => ({ path: '', size: 0, contentType: file.type }));
    },
    [apiBase, currentFile?.path, isAuthenticated],
  );

  return {
    tree,
    setTree,
    currentFile,
    setCurrentFile,
    isTreeLoading,
    setIsTreeLoading,
    loadFileTree,
    refreshFileTree: loadFileTree,
    loadFile,
    saveFile,
    uploadBinaryFile,
  };
};
