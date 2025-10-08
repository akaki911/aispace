
import { useState, useCallback } from 'react';

interface FileTreeItem {
  name: string;
  type: "file" | "directory";
  path: string;
  size: number;
  lastModified: string;
  extension?: string;
  children?: FileTreeItem[];
}

export const useFileOperations = (isAuthenticated: boolean, authUser: any) => {
  const [tree, setTree] = useState<FileTreeItem[] | null>(null);
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
    lastModified: string;
  } | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);

  const loadFileTree = useCallback(async () => {
    if (!isAuthenticated || !authUser) {
      console.log("🟡 Skipping file tree loading - not authenticated");
      return;
    }

    try {
      setIsTreeLoading(true);
      console.log("🔍 Loading file tree...");

      const response = await fetch("/api/files/tree", {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ File tree loaded successfully:", data);
        setTree(data.data || []);
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
  }, [isAuthenticated, authUser]);

  const loadFile = useCallback(async (path: string) => {
    if (!isAuthenticated) throw new Error("Authentication required");
    const response = await fetch(
      `/api/files/content/${encodeURIComponent(path)}`,
      { credentials: "include" },
    );
    if (!response.ok)
      throw new Error(`Failed to load file: ${response.statusText}`);
    const content = await response.text();
    return { content };
  }, [isAuthenticated]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!isAuthenticated) throw new Error("Authentication required");
    const response = await fetch(
      `/api/files/content/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: content,
        credentials: "include",
      },
    );
    return await response.json();
  }, [isAuthenticated]);

  return {
    tree,
    setTree,
    currentFile,
    setCurrentFile,
    isTreeLoading,
    setIsTreeLoading,
    loadFileTree,
    loadFile,
    saveFile
  };
};
