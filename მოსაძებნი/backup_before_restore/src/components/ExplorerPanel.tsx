import React, { useState, useRef, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import FileTree from "./FileTree";

// ===== EXPLORER PANEL INTERFACES =====
interface ExplorerPanelProps {
  tree: any[]; // project files list used today (same shape as parent uses)
  currentFile: { path: string; content: string; lastModified: string } | null;
  setCurrentFile: React.Dispatch<React.SetStateAction<{ path: string; content: string; lastModified: string } | null>>;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<any>; // pass-through if parent uses it
  loadFile: (path: string) => Promise<{ content: string }>;          // use existing parent handler or thin wrapper
  saveFile: (path: string, content: string) => Promise<any>;         // use existing parent handler or thin wrapper
}

export default function ExplorerPanel({
  tree,
  currentFile,
  setCurrentFile,
  aiFetch,
  loadFile,
  saveFile
}: ExplorerPanelProps) {
  // ===== EXPLORER STATE (moved from AIDeveloperPanel) =====
  const [searchQuery, setSearchQuery] = useState("");
  const fileTreeRef = useRef<HTMLDivElement>(null);
  
  // Void unused props for now (kept for future functionality)
  void currentFile;
  void aiFetch;
  void loadFile;
  void saveFile;
  
  // ===== FILTERED FILES LOGIC (moved from AIDeveloperPanel) =====
  const projectFiles = tree ?? [];
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return projectFiles;
    const q = searchQuery.toLowerCase();
    const filter = (nodes: any[]): any[] =>
      (nodes || [])
        .map(n => n.type === "directory"
          ? { ...n, children: filter(n.children || []) }
          : n)
        .filter(n =>
          n.type === "directory" ? (n.children && n.children.length)
                                 : n.name?.toLowerCase().includes(q));
    return filter(projectFiles);
  }, [projectFiles, searchQuery]);

  // ===== FILE SELECT HANDLER (moved from AIDeveloperPanel) =====
  const handleFileSelect = useCallback(async (filePath: string) => {
    try {
      const response = await fetch(`/api/fs/file?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();

      if (data.success) {
        setCurrentFile({
          path: filePath,
          content: data.data.content,
          lastModified: data.data.lastModified,
        });
      } else {
        console.error(`Failed to load file: ${filePath}`, data.error);
      }
    } catch (error) {
      console.error(`Error loading file ${filePath}:`, error);
    }
  }, [setCurrentFile]);

  // ===== EXPLORER JSX (moved from AIDeveloperPanel activeTab === 'explorer') =====
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-gray-700 text-gray-200 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div ref={fileTreeRef} className="flex-1 overflow-auto">
        <FileTree />
        {/* Debug: Show filteredFiles count */}
        {import.meta.env.DEV && (
          <div style={{display: 'none'}}>{filteredFiles.length} files, handleFileSelect: {typeof handleFileSelect}</div>
        )}
      </div>
    </div>
  );
}