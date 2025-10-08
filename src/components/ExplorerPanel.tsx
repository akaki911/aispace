import React, { type Dispatch, type SetStateAction } from 'react';

interface ExplorerPanelProps {
  tree?: unknown[];
  currentFile?: { path: string; content: string; lastModified?: string } | null;
  setCurrentFile?: Dispatch<SetStateAction<{ path: string; content: string; lastModified: string } | null>>;
  aiFetch?: (endpoint: string, options?: RequestInit) => Promise<unknown>;
  loadFile?: (path: string) => Promise<unknown>;
  saveFile?: (path: string, content: string) => Promise<unknown>;
}

const ExplorerPanel: React.FC<ExplorerPanelProps> = () => (
  <section className="rounded-3xl border border-white/10 bg-[#0E1525]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Explorer</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">ფაილებისა და რესურსების ბრაუზერის დემო ვერსია.</p>
  </section>
);

export default ExplorerPanel;
