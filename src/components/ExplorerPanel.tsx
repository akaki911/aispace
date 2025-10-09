import type { Dispatch, FC, SetStateAction } from 'react';

interface ExplorerPanelProps {
  tree: Array<{ path?: string } & Record<string, unknown>>;
  currentFile: { path: string; content: string; lastModified: string } | null;
  setCurrentFile: Dispatch<
    SetStateAction<{ path: string; content: string; lastModified: string } | null>
  >;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<unknown>;
  openFile: (path: string) => Promise<{ content: string }>;
  saveFile: (path: string, content: string) => Promise<unknown>;
  refreshTree: () => Promise<void> | void;
}

const ExplorerPanel: FC<ExplorerPanelProps> = ({
  tree,
  currentFile,
  setCurrentFile,
  aiFetch,
  openFile,
  saveFile,
  refreshTree,
}) => {
  void aiFetch;
  void openFile;
  void saveFile;

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
