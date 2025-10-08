interface GitHubStubProps {
  mode?: string;
  onOpenSettings?: () => void;
}

const GitHubStub = ({ mode, onOpenSettings }: GitHubStubProps): JSX.Element => {
  return (
    <div>
      GitHub integration is disabled.
      {mode ? <div className="mt-2 text-xs text-slate-400">Requested mode: {mode}</div> : null}
      {onOpenSettings ? (
        <button type="button" className="mt-3 rounded border border-white/20 px-3 py-1 text-xs" onClick={onOpenSettings}>
          გახსნა პარამეტრები
        </button>
      ) : null}
    </div>
  );
};

export default GitHubStub;
