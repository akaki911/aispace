import type { ChangeEvent, Dispatch, FC, SetStateAction } from 'react';
import { useMemo, useRef } from 'react';

interface CurrentFileState {
  path: string;
  content: string;
  lastModified: string;
  contentType?: string;
  blobUrl?: string | null;
  size?: number;
  isBinary?: boolean;
}

interface ExplorerPanelProps {
  tree: Array<{ path?: string } & Record<string, unknown>>;
  currentFile: CurrentFileState | null;
  setCurrentFile: Dispatch<SetStateAction<CurrentFileState | null>>;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<unknown>;
  openFile: (path: string) => Promise<{ content: string }>;
  saveFile: (path: string, content: string) => Promise<unknown>;
  refreshTree: () => Promise<void> | void;
  uploadBinaryFile: (file: File, targetPath?: string | null) => Promise<unknown>;
}

const ExplorerPanel: FC<ExplorerPanelProps> = ({
  tree,
  currentFile,
  setCurrentFile,
  aiFetch,
  openFile,
  saveFile,
  refreshTree,
  uploadBinaryFile,
}) => {
  void aiFetch;
  void openFile;
  void saveFile;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isBinaryFile = useMemo(() => {
    if (!currentFile) {
      return false;
    }
    if (typeof currentFile.isBinary === 'boolean') {
      return currentFile.isBinary;
    }
    const lower = currentFile.path.toLowerCase();
    return !lower.endsWith('.ts') && !lower.endsWith('.tsx') && !lower.endsWith('.json') && !lower.endsWith('.md');
  }, [currentFile]);

  const handleUploadViaStorage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const [nextFile] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!nextFile) {
      return;
    }
    try {
      const targetDirectory = currentFile?.path
        ? currentFile.path.split('/').slice(0, -1).join('/') || null
        : null;
      await uploadBinaryFile(nextFile, targetDirectory);
      if (typeof window !== 'undefined') {
        window.alert('ფაილი წარმატებით აიტვირთა Firebase Storage-ში.');
      }
    } catch (error) {
      console.error('Binary upload failed', error);
      if (typeof window !== 'undefined') {
        window.alert('ატვირთვა ვერ მოხერხდა. გთხოვ, სცადო ხელახლა.');
      }
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white/80">
      <div>
        <h2 className="text-lg font-semibold text-white">ფაილების მკვლევარი</h2>
        <p className="text-xs text-white/60">არსებული ინსტანცია მაკეტის რეჟიმშია. ფაილების ჩამონათვალი სიმულირებულია.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-white/60">ფაილების რაოდენობა: {tree.length}</p>
        {currentFile ? (
          <div className="mt-3 space-y-1">
            <p className="font-semibold text-white">{currentFile.path}</p>
            <p className="text-xs text-white/60">ბოლო განახლება: {currentFile.lastModified}</p>
            {isBinaryFile && (
              <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/10 p-3 text-xs text-white/70">
                <p>
                  ბინარული ფაილები მხოლოდ საცავში ინახება. ატვირთვისთვის გამოიყენე „Upload via Storage“ ღილაკი.
                </p>
                <button
                  type="button"
                  onClick={handleUploadViaStorage}
                  className="inline-flex items-center justify-center rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/30"
                >
                  Upload via Storage
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelection}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/50">ფაილი არ არის არჩეული.</p>
        )}
      </div>
      <div className="mt-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCurrentFile(null);
            void refreshTree?.();
          }}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          სტრუქტურის განახლება
        </button>
        <span className="text-[11px] text-white/50">
          სრული ფუნქციონალი ხელმისაწვდომი იქნება პროდუქტიულ გარემოში.
        </span>
      </div>
    </div>
  );
};

export default ExplorerPanel;
