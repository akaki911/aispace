interface ExplorerPanelProps {
  tree: Array<unknown>;
  currentFile: { path: string; content: string; lastModified: string } | null;
  setCurrentFile: (file: { path: string; content: string; lastModified: string } | null) => void;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<unknown>;
  loadFile: (path: string) => Promise<{ content: string }>;
  saveFile: (path: string, content: string) => Promise<unknown>;
}

const ExplorerPanel = ({
  tree,
  currentFile,
  setCurrentFile: _setCurrentFile,
  aiFetch: _aiFetch,
  loadFile: _loadFile,
  saveFile: _saveFile,
}: ExplorerPanelProps): JSX.Element => {
  return (
    <div>
      <p>Explorer panel is unavailable in this build.</p>
      <p className="mt-2 text-xs text-slate-400">Tree entries: {tree.length}</p>
      {currentFile ? (
        <p className="mt-1 text-xs text-slate-400">Current file: {currentFile.path}</p>
      ) : null}
    </div>
  );
};

export default ExplorerPanel;
