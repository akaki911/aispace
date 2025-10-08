
import React, { Suspense } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const LazyGitHubManagementHub = React.lazy(() => import('@/components/GitHubManagement/GitHubManagementHub'));
const LazyGitHubStub = React.lazy(() => import('@/pages/GitHubStub'));

const gradientBackground =
  'h-full bg-gradient-to-br from-[#0E1116]/90 via-[#1A1533]/90 to-[#351D6A]/90 text-[#E6E8EC]';
const surfaceCard =
  'rounded-3xl border border-white/10 bg-[#0F1320]/80 px-10 py-12 text-center shadow-[0_32px_70px_rgba(5,10,30,0.6)] backdrop-blur-2xl';
const loadingCard =
  'flex h-full items-center justify-center rounded-3xl border border-white/10 bg-[#0F1320]/80 text-[#A0A4AD] shadow-[0_32px_70px_rgba(5,10,30,0.55)] backdrop-blur-2xl';

interface GitHubTabProps {
  hasDevConsoleAccess: boolean;
  onOpenSettings?: () => void;
}

const GitHubTab: React.FC<GitHubTabProps> = ({ hasDevConsoleAccess, onOpenSettings }) => {
  if (!hasDevConsoleAccess) {
    return (
      <div className={`${gradientBackground} flex items-center justify-center px-6`}>
        <div className={`${surfaceCard} max-w-md space-y-4`}> 
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-semibold tracking-wide text-white">წვდომა შეზღუდულია</h2>
          <p className="text-sm text-[#A0A4AD]">
            GitHub პანელზე წვდომა მხოლოდ ადმინისტრატორებს აქვთ. გთხოვთ, დაუკავშირდით სისტემის მენეჯერს უფლებების მისაღებად.
          </p>
        </div>
      </div>
    );
  }

  const isGitHubEnabled = useFeatureFlag('GITHUB');

  if (!isGitHubEnabled) {
    return (
      <div className={`${gradientBackground} overflow-hidden`}> 
        <div className="h-full px-6 pb-6 pt-4">
          <div className="h-full rounded-3xl border border-white/10 bg-[#0F1320]/70 shadow-[0_32px_70px_rgba(5,10,30,0.55)] backdrop-blur-2xl">
            <Suspense
              fallback={
                <div className={loadingCard}>
                  <div className="text-center space-y-2">
                    <div className="text-sm font-semibold text-white/80">GitHub ინფორმაცია იტვირთება…</div>
                    <div className="text-xs text-[#7C7F8F]">
                      გთხოვთ მოითმინოთ სანამ ინტეგრაციის მოდული ჩაიტვირთება.
                    </div>
                  </div>
                </div>
              }
            >
              <LazyGitHubStub mode="panel" onOpenSettings={onOpenSettings} />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${gradientBackground} overflow-hidden`}>
      <div className="h-full px-6 pb-6 pt-4">
        <div className="h-full rounded-3xl border border-white/10 bg-[#0F1320]/80 shadow-[0_35px_80px_rgba(5,10,30,0.6)] backdrop-blur-2xl">
          <Suspense
            fallback={
              <div className={loadingCard}>
                <div className="text-center space-y-2">
                  <div className="text-sm font-semibold text-white/80">GitHub პანელი იტვირთება…</div>
                  <div className="text-xs text-[#7C7F8F]">გთხოვთ მოითმინოთ სანამ მოდული ჩაიტვირთება.</div>
                </div>
              </div>
            }
          >
            <LazyGitHubManagementHub />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default GitHubTab;
