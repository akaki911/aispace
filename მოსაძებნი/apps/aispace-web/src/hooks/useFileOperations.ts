
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

export const useFileOperations = (isAuthenticated: boolean, authUser: any) => {
  const [tree, setTree] = useState<FileTreeItem[] | null>(null);
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
    lastModified: string;
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
    const content = contentType?.includes('application/json')
      ? JSON.stringify(await response.json(), null, 2)
      : await response.text();

    return { content };
  }, [apiBase, isAuthenticated]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!isAuthenticated) throw new Error("Authentication required");

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
    saveFile
  };
};
