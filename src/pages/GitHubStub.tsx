import React from 'react';

const GitHubStub: React.FC<{ mode?: string; onOpenSettings?: () => void }> = ({ onOpenSettings }) => (
  <div className="rounded-3xl border border-white/10 bg-[#0E1524]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">GitHub Integration Coming Soon</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">ამ პანელში მალე გამოჩნდება GitHub-ის სრულყოფილი მართვის მოდული.</p>
    {onOpenSettings ? (
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:border-white/40"
      >
        ღილაკი პარამეტრებისთვის
      </button>
    ) : null}
  </div>
);

export default GitHubStub;
