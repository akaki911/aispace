import React, { useState, useRef, useCallback } from 'react';
import {
  IconCopy,
  IconCheck,
  IconPlus,
  IconUpload,
  IconFolderPlus,
  IconDownload,
  IconRefresh
} from '@tabler/icons-react';
import JSZip from 'jszip';
import { FileNode, NewFileModal, ContextMenu } from '../../types/fileTree';
import { encodeForHeader } from '../../utils/fileTreeUtils';

interface FileOperationsProps {
  fileTree: FileNode[];
  contextMenu: ContextMenu;
  hideContextMenu: () => void;
  newFileModal: NewFileModal;
  openNewFileModal: (type: 'file' | 'folder', parentPath?: string) => void;
  closeNewFileModal: () => void;
  copiedToClipboard: boolean;
  setCopiedToClipboard: (copied: boolean) => void;
  isDownloading: boolean;
  setIsDownloading: (downloading: boolean) => void;
  setError: (error: string | null) => void;
  loadFileTree: () => void;
}

// New File/Folder Modal Component
const NewFileModalComponent: React.FC<{
  isOpen: boolean;
  type: 'file' | 'folder';
  parentPath?: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}> = ({ isOpen, type, parentPath, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !creating) {
      setCreating(true);
      try {
        await onConfirm(name.trim());
        setName('');
        onClose();
      } catch (error) {
        console.error('Failed to create file/folder:', error);
      } finally {
        setCreating(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold text-[#e6edf3] mb-4">
          შექმენი ახალი {type === 'file' ? 'ფაილი' : 'ფოლდერი'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-[#7d8590] mb-2">
              {type === 'file' ? 'ფაილის სახელი' : 'ფოლდერის სახელი'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'file' ? 'example.txt' : 'new-folder'}
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
              autoFocus
              disabled={creating}
            />
            {parentPath && (
              <p className="text-xs text-[#7d8590] mt-1">
                მდებარეობა: {parentPath}/
              </p>
            )}
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 text-[#7d8590] hover:text-[#e6edf3] transition-colors disabled:opacity-50"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={!name.trim() || creating}
              className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>შექმნა...</span>
                </>
              ) : (
                <span>შექმნა</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FileOperations: React.FC<FileOperationsProps> = ({
  fileTree,
  contextMenu,
  hideContextMenu,
  newFileModal,
  openNewFileModal,
  closeNewFileModal,
  copiedToClipboard,
  setCopiedToClipboard,
  isDownloading,
  setIsDownloading,
  setError,
  loadFileTree
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Copy file path to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [setCopiedToClipboard]);

  // Create new file or folder
  const createNewItem = useCallback(async (name: string) => {
    const path = newFileModal.parentPath 
      ? `${newFileModal.parentPath}/${name}`
      : name;

    try {
      const endpoint = newFileModal.type === 'file' ? '/api/files/create' : '/api/files/create-folder';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path })
      });

      if (!response.ok) {
        throw new Error(`Failed to create ${newFileModal.type}`);
      }

      // Refresh file tree after creation
      loadFileTree();
    } catch (error) {
      console.error(`Failed to create ${newFileModal.type}:`, error);
      throw error;
    }
  }, [newFileModal, loadFileTree]);

  // File upload handlers
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return null;

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      loadFileTree();
    } catch (error) {
      console.error('Failed to upload files:', error);
      setError('ფაილების ატვირთვა ვერ მოხერხდა');
    }
    return null;
  }, [loadFileTree, setError]);

  // ULTRA-FAST Server-Side ZIP download - Replit Performance Level!
  const downloadAsZip = useCallback(async () => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);
      console.log('🚀 Starting ULTRA-FAST server-side ZIP download...');
      const startTime = Date.now();

      // Call optimized server-side ZIP creation endpoint
      const response = await fetch('/api/bulk/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      // Handle the streamed ZIP response
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `gurulo-workspace-${new Date().toISOString().split('T')[0]}.zip`;

      // Convert response to blob
      const zipBlob = await response.blob();
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ ULTRA-FAST ZIP download complete in ${duration.toFixed(1)}s!`);
      console.log(`📦 Archive size: ${(zipBlob.size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`🚀 Performance: ${duration <= 10 ? 'REPLIT-LEVEL SPEED!' : 'Good performance'}`);
      
      
      // Show success message
      setTimeout(() => {
        alert(`✅ წარმატებით ჩამოიტვირთა! ზომა: ${(zipBlob.size / 1024 / 1024).toFixed(1)}MB, დრო: ${duration.toFixed(1)}s`);
      }, 500);

    } catch (error) {
      console.error('❌ ZIP download failed:', error);
      setError(`ZIP ჩამოტვირთვა ვერ მოხერხდა: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  }, [fileTree, isDownloading, setError]);

  return (
    <>
      {/* File operation buttons */}
      <div className="p-3 border-b border-[#21262d] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => openNewFileModal('file')}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
              title="ახალი ფაილი"
            >
              <IconPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => openNewFileModal('folder')}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
              title="ახალი ფოლდერი"
            >
              <IconFolderPlus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
              title="ფაილების ატვირთვა"
            >
              <IconUpload className="w-4 h-4" />
            </button>
            <button
              onClick={downloadAsZip}
              disabled={isDownloading}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors disabled:opacity-50 relative group"
              title={isDownloading ? "იტვირთება ZIP ფაილი..." : "ZIP ჩამოტვირთვა"}
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#e6edf3] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    📦 ZIP ჩამოტვირთვა მიმდინარეობს...
                  </div>
                </>
              ) : (
                <>
                  <IconDownload className="w-4 h-4" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#e6edf3] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    📁 ყველა ფაილის ZIP ჩამოტვირთვა
                  </div>
                </>
              )}
            </button>
            <button
              onClick={loadFileTree}
              className="p-1 text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
              title="განახლება"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-lg py-2 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <button
            onClick={() => {
              copyToClipboard(contextMenu.path);
              hideContextMenu();
            }}
            className="w-full px-3 py-2 text-left text-sm text-[#e6edf3] hover:bg-[#21262d] transition-colors flex items-center space-x-2"
          >
            {copiedToClipboard ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
            <span>კოპირება</span>
          </button>
          <hr className="border-[#21262d] my-1" />
          <button
            onClick={() => {
              openNewFileModal('file', contextMenu.type === 'directory' ? contextMenu.path : undefined);
              hideContextMenu();
            }}
            className="w-full px-3 py-2 text-left text-sm text-[#e6edf3] hover:bg-[#21262d] transition-colors flex items-center space-x-2"
          >
            <IconPlus className="w-4 h-4" />
            <span>ახალი ფაილი</span>
          </button>
          <button
            onClick={() => {
              openNewFileModal('folder', contextMenu.type === 'directory' ? contextMenu.path : undefined);
              hideContextMenu();
            }}
            className="w-full px-3 py-2 text-left text-sm text-[#e6edf3] hover:bg-[#21262d] transition-colors flex items-center space-x-2"
          >
            <IconFolderPlus className="w-4 h-4" />
            <span>ახალი ფოლდერი</span>
          </button>
        </div>
      )}

      {/* New File/Folder Modal */}
      <NewFileModalComponent
        isOpen={newFileModal.isOpen}
        type={newFileModal.type}
        parentPath={newFileModal.parentPath}
        onClose={closeNewFileModal}
        onConfirm={createNewItem}
      />
    </>
  );
};