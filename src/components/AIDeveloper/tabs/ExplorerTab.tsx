
import React from 'react';
import ExplorerPanel from '@/components/ExplorerPanel';

interface ExplorerTabProps {
  tree: any[];
  currentFile: { path: string; content: string; lastModified: string } | null;
  setCurrentFile: React.Dispatch<React.SetStateAction<{ path: string; content: string; lastModified: string } | null>>;
  aiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  loadFile: (path: string) => Promise<{ content: string }>;
  saveFile: (path: string, content: string) => Promise<any>;
}

const ExplorerTab: React.FC<ExplorerTabProps> = ({
  tree,
  currentFile,
  setCurrentFile,
  aiFetch,
  loadFile,
  saveFile
}) => {
  return (
    <div className="h-full bg-gradient-to-br from-[#0E1116]/90 via-[#1A1533]/90 to-[#351D6A]/90 text-[#E6E8EC]">
      <div className="h-full px-6 pb-6 pt-4">
        <div className="h-full overflow-hidden rounded-3xl border border-white/10 bg-[#0F1320]/80 backdrop-blur-2xl shadow-[0_35px_80px_rgba(5,10,30,0.55)]">
          <ExplorerPanel
            tree={tree}
            currentFile={currentFile}
            setCurrentFile={setCurrentFile}
            aiFetch={aiFetch}
            loadFile={loadFile}
            saveFile={saveFile}
          />
        </div>
      </div>
    </div>
  );
};

export default ExplorerTab;
