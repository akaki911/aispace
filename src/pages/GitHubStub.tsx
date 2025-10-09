import type { FC } from 'react';

interface GitHubStubProps {
  mode?: 'panel' | 'settings';
  onOpenSettings?: () => void;
}

const GitHubStub: FC<GitHubStubProps> = ({ mode = 'panel', onOpenSettings }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-white/70">
    <span className="text-3xl">🔧</span>
    <div>
      <p className="text-sm">
        GitHub ინტეგრაცია ({mode}) ამ გარემოში სტუბ რეჟიმშია. რეალური ფუნქციონალი გამოჩნდება წარმოებაში.
      </p>
      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          პარამეტრების გახსნა
        </button>
      ) : null}
    </div>
  </div>
);

export default GitHubStub;
