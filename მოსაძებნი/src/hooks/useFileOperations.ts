import { useState, useCallback, useRef } from 'react';

export class HttpError extends Error {
  status: number;
  statusText: string;
  body?: string;

  constructor(message: string, init: { status: number; statusText?: string; body?: string }) {
    super(message);
    this.name = 'HttpError';
    this.status = init.status;
    this.statusText = init.statusText ?? '';
    this.body = init.body;
  }
}

export interface FileTreeItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  lastModified?: string;
  extension?: string;
  children?: FileTreeItem[];
}

interface FileCacheEntry {
  content: string;
  lastModified: string;
  lastFetched: number;
  pending?: boolean;
}

interface TreeCacheEntry {
  data: FileTreeItem[];
  timestamp: number;
}

const TREE_CACHE_TTL = 30_000; // 30 seconds
const FILE_CACHE_TTL = 10_000; // 10 seconds

const createHttpError = async (response: Response, fallbackMessage: string): Promise<HttpError> => {
  const bodyText = await response.text().catch(() => '');
  const message = bodyText || fallbackMessage || response.statusText;
  return new HttpError(message, {
    status: response.status,
    statusText: response.statusText,
    body: bodyText || undefined,
  });
};

const sanitizePath = (rawPath: string): string => {
  const path = rawPath?.trim();
  if (!path) {
    throw new Error('Path is required');
  }

  if (path.includes('..') || path.includes('\u0000')) {
    throw new Error('Unsafe file path');
  }

  if (/^[a-zA-Z]:\\/.test(path) || path.startsWith('/') || path.startsWith('\\\\')) {
    throw new Error('Absolute paths are not allowed');
  }

  return path.replace(/\\+/g, '/');
};

const buildHeaders = (authUser: any, extra: HeadersInit = {}): HeadersInit => {
  const headers: Record<string, string> = {};

  if (authUser?.personalId) {
    headers['X-User-ID'] = String(authUser.personalId);
  } else if (authUser?.id) {
    headers['X-User-ID'] = String(authUser.id);
  }

  if (authUser?.role) {
    headers['X-User-Role'] = String(authUser.role);
  }

  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  if (Array.isArray(extra)) {
    extra.forEach(([key, value]) => {
      headers[key] = value;
    });
    return headers;
  }

  return { ...headers, ...(extra as Record<string, string>) };
};

const updateTreeNodeTimestamp = (nodes: FileTreeItem[], targetPath: string, lastModified: string): FileTreeItem[] =>
  nodes.map(node => {
    if (node.path === targetPath) {
      return { ...node, lastModified };
    }

    if (node.children?.length) {
      return { ...node, children: updateTreeNodeTimestamp(node.children, targetPath, lastModified) };
    }

    return node;
  });

const removeTreeNode = (nodes: FileTreeItem[], targetPath: string): FileTreeItem[] =>
  nodes
    .map(node => {
      if (node.path === targetPath) {
        return null;
      }

      if (node.children?.length) {
        return { ...node, children: removeTreeNode(node.children, targetPath) };
      }

      return node;
    })
    .filter((node): node is FileTreeItem => Boolean(node));

export const useFileOperations = (isAuthenticated: boolean, authUser: any) => {
  const [tree, setTree] = useState<FileTreeItem[] | null>(null);
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
    lastModified: string;
  } | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);

  const treeCacheRef = useRef<TreeCacheEntry | null>(null);
  const fileCacheRef = useRef<Map<string, FileCacheEntry>>(new Map());

  const loadFileTree = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) {
        setTree(null);
        return null;
      }

      const now = Date.now();
      if (!force && treeCacheRef.current && now - treeCacheRef.current.timestamp < TREE_CACHE_TTL) {
        setTree(treeCacheRef.current.data);
        return treeCacheRef.current.data;
      }

      setIsTreeLoading(true);

      try {
        const response = await fetch('/api/files/tree', {
          method: 'GET',
          credentials: 'include',
          headers: buildHeaders(authUser, {
            Accept: 'application/json',
          }),
        });

        if (!response.ok) {
          throw await createHttpError(response, `Failed to load file tree (${response.status})`);
        }

        const payload = await response.json();
        const data: FileTreeItem[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.files)
            ? payload.files
            : [];

        treeCacheRef.current = { data, timestamp: Date.now() };
        setTree(data);

        return data;
      } catch (error) {
        console.error('Failed to load file tree', error);
        throw error;
      } finally {
        setIsTreeLoading(false);
      }
    },
    [authUser, isAuthenticated],
  );

  const loadFile = useCallback(
    async (rawPath: string, { force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      const path = sanitizePath(rawPath);
      const now = Date.now();
      const cached = fileCacheRef.current.get(path);

      if (!force && cached && now - cached.lastFetched < FILE_CACHE_TTL) {
        setCurrentFile({ path, content: cached.content, lastModified: cached.lastModified });
        return { content: cached.content, lastModified: cached.lastModified };
      }

      const response = await fetch(`/api/files/content/${encodeURIComponent(path)}`, {
        method: 'GET',
        credentials: 'include',
        headers: buildHeaders(authUser, { Accept: 'text/plain' }),
      });

      if (!response.ok) {
        throw await createHttpError(response, `Failed to load file ${path}`);
      }

      const content = await response.text();
      const lastModified = response.headers.get('Last-Modified') ?? new Date().toISOString();

      const entry: FileCacheEntry = {
        content,
        lastModified,
        lastFetched: Date.now(),
      };

      fileCacheRef.current.set(path, entry);
      setCurrentFile({ path, content, lastModified });

      return { content, lastModified };
    },
    [authUser, isAuthenticated],
  );

  const saveFile = useCallback(
    async (rawPath: string, content: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      const path = sanitizePath(rawPath);
      const previousEntry = fileCacheRef.current.get(path);
      const optimisticLastModified = new Date().toISOString();

      const optimisticEntry: FileCacheEntry = {
        content,
        lastModified: optimisticLastModified,
        lastFetched: Date.now(),
        pending: true,
      };

      fileCacheRef.current.set(path, optimisticEntry);
      setCurrentFile(prev => (prev && prev.path === path ? { ...prev, content, lastModified: optimisticLastModified } : prev));

      if (treeCacheRef.current) {
        const nextTree = updateTreeNodeTimestamp(treeCacheRef.current.data, path, optimisticLastModified);
        treeCacheRef.current = { data: nextTree, timestamp: Date.now() };
        setTree(nextTree);
      }

      try {
        const response = await fetch('/api/files/save', {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(authUser, {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({ path, content }),
        });

        if (!response.ok) {
          throw await createHttpError(response, `Failed to save file ${path}`);
        }

        const payload = await response.json().catch(() => ({}));
        const serverModified = payload?.data?.lastModified ?? new Date().toISOString();

        const entry: FileCacheEntry = {
          content,
          lastModified: serverModified,
          lastFetched: Date.now(),
        };

        fileCacheRef.current.set(path, entry);
        setCurrentFile(prev => (prev && prev.path === path ? { ...prev, lastModified: serverModified } : prev));

        if (treeCacheRef.current) {
          const nextTree = updateTreeNodeTimestamp(treeCacheRef.current.data, path, serverModified);
          treeCacheRef.current = { data: nextTree, timestamp: Date.now() };
          setTree(nextTree);
        }

        return payload;
      } catch (error) {
        if (previousEntry) {
          fileCacheRef.current.set(path, previousEntry);
        } else {
          fileCacheRef.current.delete(path);
        }

        setCurrentFile(prev =>
          prev && prev.path === path
            ? {
                path,
                content: previousEntry?.content ?? prev.content,
                lastModified: previousEntry?.lastModified ?? prev.lastModified,
              }
            : prev,
        );

        if (treeCacheRef.current && previousEntry?.lastModified) {
          const nextTree = updateTreeNodeTimestamp(treeCacheRef.current.data, path, previousEntry.lastModified);
          treeCacheRef.current = { data: nextTree, timestamp: treeCacheRef.current.timestamp };
          setTree(nextTree);
        }

        throw error;
      }
    },
    [authUser, isAuthenticated],
  );

  const deleteFile = useCallback(
    async (rawPath: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }

      const path = sanitizePath(rawPath);
      const previousTree = treeCacheRef.current;
      const currentTree = previousTree?.data ?? tree ?? [];
      const optimisticTree = removeTreeNode(currentTree, path);

      treeCacheRef.current = { data: optimisticTree, timestamp: Date.now() };
      setTree(optimisticTree);
      fileCacheRef.current.delete(path);

      setCurrentFile(prev => (prev && prev.path === path ? null : prev));

      try {
        const response = await fetch('/api/files/delete', {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(authUser, {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({ path }),
        });

        if (!response.ok) {
          throw await createHttpError(response, `Failed to delete file ${path}`);
        }

        return await response.json().catch(() => ({}));
      } catch (error) {
        if (previousTree) {
          treeCacheRef.current = previousTree;
          setTree(previousTree.data);
        }

        throw error;
      }
    },
    [authUser, isAuthenticated, tree],
  );

  return {
    tree,
    setTree,
    currentFile,
    setCurrentFile,
    isTreeLoading,
    setIsTreeLoading,
    loadFileTree,
    loadFile,
    saveFile,
    deleteFile,
    refreshFileTree: () => loadFileTree({ force: true }),
  };
};
