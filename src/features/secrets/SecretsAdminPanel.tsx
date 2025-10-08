import React from 'react';

interface SecretsAdminPanelProps {
  onRefresh?: () => void;
}

export const SecretsAdminPanel: React.FC<SecretsAdminPanelProps> = ({ onRefresh }) => (
  <section className="rounded-3xl border border-white/10 bg-[#11192C]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Secrets Management</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      საიდუმლო კონფიგურაციები ამ ინსტალაციაში ხელმისაწვდომია მხოლოდ დემო რეჟიმში.
    </p>
    <button
      type="button"
      onClick={onRefresh}
      className="mt-4 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:border-white/40"
    >
      განახლება
    </button>
  </section>
);
