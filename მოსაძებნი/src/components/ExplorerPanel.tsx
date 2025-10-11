import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, FolderOpen, Loader2, RefreshCcw, Save } from 'lucide-react';
import { HttpError } from '../hooks/useFileOperations';

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  lastModified?: string;
  children?: FileTreeNode[];
}

interface ExplorerPanelProps {
  tree: FileTreeNode[] | null;
  currentFile: { path: string; content: string; lastModified: string } | null;
  setCurrentFile: React.Dispatch<
    React.SetStateAction<{ path: string; content: string; lastModified: string } | null>
  >;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  openFile: (path: string) => Promise<{ content: string } | { content: string; lastModified?: string }>;
  saveFile: (path: string, content: string) => Promise<unknown>;
  refreshTree: () => Promise<void> | void;
}

const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
  return [...nodes].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name, 'en');
    }
    return a.type === 'directory' ? -1 : 1;
  });
};

const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  tree,
  currentFile,
  setCurrentFile,
  openFile,
  saveFile,
  refreshTree,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);

  const safeTree = useMemo(() => sortNodes(Array.isArray(tree) ? tree : []), [tree]);

  const toggleDirectory = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleOpenFile = useCallback(
    async (node: FileTreeNode) => {
      if (node.type !== 'file') {
        return;
      }

      setSelectedPath(node.path);
      setIsOpening(true);
      try {
        const result = await openFile(node.path);
        const content = 'content' in result ? result.content : '';
        const lastModified = (result as { lastModified?: string }).lastModified ?? node.lastModified ?? new Date().toISOString();
        setCurrentFile({ path: node.path, content, lastModified });
        setIsBackendAvailable(true);
      } catch (error) {
        console.error('❌ Failed to open file:', error);
        const status = error instanceof HttpError ? error.status : undefined;
        if (status === 404 || (typeof status === 'number' && status >= 500)) {
          toast.error(`ფაილის ჩატვირთვა ვერ მოხერხდა (${status})`);
          setIsBackendAvailable(false);
        } else {
          toast.error('ფაილის ჩატვირთვა ვერ მოხერხდა.');
        }
      } finally {
        setIsOpening(false);
      }
    },
    [openFile, setCurrentFile],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.resolve(refreshTree());
      setIsBackendAvailable(true);
    } catch (error) {
      console.error('❌ Failed to refresh file tree:', error);
      const status = error instanceof HttpError ? error.status : undefined;
      if (status === 404 || (typeof status === 'number' && status >= 500)) {
        toast.error(`ფაილების ხე დროებით მიუწვდომელია (${status})`);
        setIsBackendAvailable(false);
      } else {
        toast.error('ფაილების განახლება ვერ მოხერხდა.');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshTree]);

  const handleSave = useCallback(async () => {
    if (!currentFile) {
      return;
    }

    setIsSaving(true);
    try {
      await saveFile(currentFile.path, currentFile.content);
      setIsBackendAvailable(true);
    } catch (error) {
      console.error('❌ Failed to save file:', error);
      const status = error instanceof HttpError ? error.status : undefined;
      if (status === 404 || (typeof status === 'number' && status >= 500)) {
        toast.error(`შენახვა ვერ მოხერხდა (${status})`);
        setIsBackendAvailable(false);
      } else {
        toast.error('შენახვა ვერ მოხერხდა.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [currentFile, saveFile]);

  const handleReopen = useCallback(() => {
    if (!selectedPath) {
      return;
    }

    const nodeQueue = [...safeTree];
    while (nodeQueue.length > 0) {
      const candidate = nodeQueue.shift();
      if (!candidate) continue;
      if (candidate.path === selectedPath) {
        void handleOpenFile(candidate);
        return;
      }
      if (candidate.children) {
        nodeQueue.push(...candidate.children);
      }
    }
  }, [handleOpenFile, safeTree, selectedPath]);

  const renderNodes = useCallback(
    (nodes: FileTreeNode[], depth = 0) => {
      return nodes.map((node) => {
        const paddingLeft = 16 + depth * 16;
        const isDirectory = node.type === 'directory';
        const isExpanded = expanded.has(node.path);
        const isActive = currentFile?.path === node.path || selectedPath === node.path;

        return (
          <div key={node.path} className="text-sm text-slate-200">
            <button
              type="button"
              onClick={() => {
                if (isDirectory) {
                  toggleDirectory(node.path);
                } else {
                  void handleOpenFile(node);
                }
                setSelectedPath(node.path);
              }}
              className={`flex w-full items-center gap-2 rounded px-3 py-1 text-left transition hover:bg-white/10 ${
                isActive ? 'bg-white/10 text-white' : 'text-slate-200'
              }`}
              style={{ paddingLeft }}
            >
              {isDirectory ? (
                isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center text-xs">•</span>
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isDirectory && isExpanded && Array.isArray(node.children) && node.children.length > 0 && (
              <div>{renderNodes(sortNodes(node.children), depth + 1)}</div>
            )}
          </div>
        );
      });
    },
    [currentFile?.path, expanded, handleOpenFile, selectedPath, toggleDirectory],
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-[#141827]/80 via-[#0F1320]/85 to-[#1D1540]/90 text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">ფაილების მენეჯერი</h2>
          {currentFile ? (
            <p className="text-xs text-slate-400">{currentFile.path}</p>
          ) : (
            <p className="text-xs text-slate-500">აირჩიე ფაილი სანახავად ან რედაქტირებისთვის</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            განახლება
          </button>
          <button
            type="button"
            onClick={handleReopen}
            disabled={!selectedPath || isOpening}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isOpening ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
            გახსნა
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!currentFile || isSaving || !isBackendAvailable}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            შენახვა
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2 py-4">
        {safeTree.length > 0 ? (
          <div className="space-y-1">{renderNodes(safeTree)}</div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {isRefreshing ? 'ფაილები იტვირთება...' : 'ფაილების სია ცარიელია'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorerPanel;
