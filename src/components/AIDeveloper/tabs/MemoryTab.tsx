
import React, { useCallback, useMemo, useState } from 'react';
import AIMemoryManager from '@/components/AIMemoryManager';
import { useAuth } from '@/contexts/useAuth';
import { useMemoryControls } from '@/hooks/memory/useMemoryControls';
import MemoryControlsPanel from '../memory/MemoryControlsPanel';

interface MemoryTabProps {
  isAuthenticated: boolean;
}

const MemoryTab: React.FC<MemoryTabProps> = ({ isAuthenticated }) => {
  const { user } = useAuth();
  const { controls, memories, metrics, loading, error, toggleFeature, refresh, saveMemory } = useMemoryControls(
    isAuthenticated ? user?.personalId : null,
  );
  const [showExpandedView, setShowExpandedView] = useState(true);

  const handleQuickSaveMemory = useCallback(() => {
    const timestamp = new Date();
    const key = `quick-note-${timestamp.getTime()}`;
    const localized = timestamp.toLocaleString('ka-GE');

    return saveMemory({
      key,
      value: `სწრაფი ჩანაწერი მეხსიერების პანელიდან (${localized})`,
      userConfirmed: true,
      summary: 'პანელიდან შენახული ავტომატური ჩანაწერი',
      tags: ['quick-save', 'panel'],
    });
  }, [saveMemory]);

  const isMemoryFeatureEnabled = useMemo(
    () => controls.referenceSavedMemories || controls.referenceChatHistory,
    [controls.referenceChatHistory, controls.referenceSavedMemories],
  );
  const expandedViewEnabled = showExpandedView && isMemoryFeatureEnabled;

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-[#0E1116] via-[#1A1533] to-[#2C214E] px-6 text-[#E6E8EC]">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 px-10 py-12 text-center backdrop-blur-2xl shadow-[0_28px_60px_rgba(8,10,26,0.6)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-[#121622]/80 shadow-[0_16px_36px_rgba(60,32,128,0.35)]">
            <span className="text-2xl">🔐</span>
          </div>
          <div className="text-lg font-semibold tracking-wide">ავთენტიფიკაცია საჭიროა</div>
          <div className="mt-2 text-sm text-[#A0A4AD]">მეხსიერების მენეჯერზე წვდომისთვის საჭიროა ავტორიზაცია</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#0E1116]/90 via-[#1A1533]/90 to-[#351D6A]/90 p-6 text-[#E6E8EC]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-[#0F1320]/80 p-6 backdrop-blur-2xl shadow-[0_32px_70px_rgba(5,10,30,0.6)]">
          <MemoryControlsPanel
            controls={controls}
            memories={memories}
            metrics={metrics}
            loading={loading}
            error={error}
            onToggle={toggleFeature}
            onRefresh={refresh}
            onSaveQuickMemory={handleQuickSaveMemory}
            userDisplayName={user?.displayName || user?.email || user?.personalId}
            expandedViewEnabled={expandedViewEnabled}
            onExpandedViewChange={setShowExpandedView}
          />
        </div>
        <div
          id="gurulo-memory-manager"
          className="rounded-3xl border border-white/10 bg-[#121622]/80 p-4 backdrop-blur-2xl shadow-[0_32px_70px_rgba(5,10,30,0.6)]"
        >
          {isMemoryFeatureEnabled ? (
            expandedViewEnabled ? (
              <AIMemoryManager />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0B1220]/70 px-6 py-12 text-center text-sm text-[#C8CBE0] shadow-[0_20px_50px_rgba(8,14,36,0.55)]">
                <div className="text-base font-semibold text-white">გაფართოებული მენეჯერი დროებით ჩაკეცილია</div>
                <p className="max-w-lg text-xs text-[#9AA0B5]">
                  გამოიყენე ზემოთა პანელის ღილაკი „სრული ხედვის გახსნა", რათა კვლავ იხილო გურულოს სრულყოფილი მეხსიერების მენეჯერი და განახლებები რეალურ დროში.
                </p>
                <button
                  type="button"
                  onClick={() => setShowExpandedView(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#25D98E]/50 bg-[#25D98E]/15 px-5 py-2 text-sm font-semibold text-[#25D98E] transition-all duration-200 hover:border-[#25D98E]/70 hover:bg-[#25D98E]/25 hover:text-white"
                >
                  სრული ხედვის გახსნა
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#25D98E]/50 bg-[#122224]/80 px-6 py-12 text-center text-sm text-[#A7F5D0] shadow-[0_20px_50px_rgba(8,14,36,0.5)]">
              <div className="text-base font-semibold text-[#25D98E]">ფუნქციები გამორთულია</div>
              <p className="max-w-lg text-xs text-[#8AD5B2]">
                სრული მეხსიერების მენეჯერისთვის გააქტიურე „შენახული მეხსიერებები" ან „ჩატის ისტორია". ჩართვის შემდეგ აქ გამოჩნდება გურულოს გაერთიანებული მეხსიერების მართვის პანელი.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryTab;
