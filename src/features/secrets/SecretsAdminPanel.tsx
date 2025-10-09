import type { FC } from 'react';

interface SecretsAdminPanelProps {
  variant?: 'page' | 'panel';
}

export const SecretsAdminPanel: FC<SecretsAdminPanelProps> = ({ variant = 'panel' }) => {
  return (
    <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-white/80">
      <h3 className="text-lg font-semibold text-white">Secrets manager ({variant})</h3>
      <p className="mt-2 text-xs leading-relaxed text-white/60">
        Secrets management tooling is currently mocked for the demo environment. Implementations that communicate with the
        production API can be wired in through <code>src/features/secrets</code>.
      </p>
    </div>
  );
};

export default SecretsAdminPanel;
