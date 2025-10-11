import { GitBranch, Lock, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FC } from 'react';
import { useCallback } from 'react';

interface GitHubStubProps {
  mode?: 'page' | 'panel';
  onOpenSettings?: () => void;
}

const gradientBackground = 'bg-gradient-to-br from-[#0E1116] via-[#1A1533] to-[#2C214E] text-[#E6E8EC]';
const cardSurface =
  'w-full rounded-3xl border border-white/10 bg-[#0F1320]/80 p-10 text-center shadow-[0_32px_70px_rgba(5,10,30,0.6)] backdrop-blur-2xl';
const highlightCard = 'flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-[#C8CBE0]';
const accentCard = 'flex items-start gap-3 rounded-2xl border border-[#7C6CFF]/40 bg-[#7C6CFF]/10 p-4 text-left text-sm text-[#D9D4FF]';

const GitHubStub: FC<GitHubStubProps> = ({ mode = 'page', onOpenSettings }) => {
  const navigate = useNavigate();

  const handleOpenSettings = useCallback(() => {
    if (typeof onOpenSettings === 'function') {
      onOpenSettings();
      return;
    }

    navigate('/admin/ai-developer?tab=settings');
  }, [navigate, onOpenSettings]);

  const isPanel = mode === 'panel';
  const containerClasses = isPanel
    ? `h-full w-full ${gradientBackground} px-6 py-8`
    : `min-h-[60vh] w-full ${gradientBackground} px-6 py-16`;
  const layoutClasses = isPanel
    ? 'mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center'
    : 'mx-auto flex max-w-3xl flex-col items-center justify-center text-center';

  return (
    <div className={containerClasses}>
      <div className={`${layoutClasses} space-y-6`}>
        <div className={cardSurface}>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#7C6CFF]/40 bg-[#7C6CFF]/15 text-[#B9B1FF] shadow-[0_18px_32px_rgba(124,108,255,0.35)]">
            <GitBranch className="h-7 w-7" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            GitHub ინტეგრაცია დროებით გამორთულია
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-[#A0A4AD] sm:text-base">
            ჩართეთ <code className="rounded border border-white/10 bg-[#1C2130] px-1.5 py-0.5 text-xs text-white">VITE_GITHUB_ENABLED</code>
            {' '}ფიჩერი, რათა მიიღოთ წვდომა ავტომატურ დეპლოებზე, GitOps მონიტორინგსა და რეპოზიტორიის ანალიტიკაზე.
          </p>

          <div className="mt-8 w-full space-y-4 text-left">
            <div className={highlightCard}>
              <Lock className="mt-1 h-4 w-4 text-[#7C7F8F]" />
              <div>
                <p className="font-semibold text-white">რატომ არ ჩანს პანელი?</p>
                <p className="mt-1 text-xs text-[#A0A4AD] sm:text-sm">
                  ინტეგრაცია გამორთულია, რათა მივიღოთ სწრაფი ჩატვირთვა და არ ჩაიტვირთოს ზედმეტი ანალიტიკური მოდულები სანამ ისინი საჭირო არ გახდება.
                </p>
              </div>
            </div>

            <div className={accentCard}>
              <Settings className="mt-1 h-4 w-4 text-[#C8C5FF]" />
              <div>
                <p className="font-semibold text-white">როგორ ჩავრთოთ ინტეგრაცია</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#CECFFF] sm:text-sm">
                  <li>
                    შედი <span className="font-medium text-white">პარამეტრები → GitHub ინტეგრაცია</span> და გააქტიურე ტოგლი.
                  </li>
                  <li>
                    შეინახე ცვლილება გარემოში <code className="rounded border border-white/10 bg-[#1C2130] px-1 py-0.5 text-[11px] text-white">VITE_GITHUB_ENABLED=1</code>,
                    რათა მომდევნო სესიებში ავტომატურად ჩაირთოს.
                  </li>
                  <li>დაბრუნდი აქ და აკონტროლე რეპოზიტორიები, ავტომატური სამუშაოები და GitOps სტატუსი.</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenSettings}
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl border border-[#7C6CFF]/50 bg-gradient-to-br from-[#7C6CFF] via-[#4B3FA8] to-[#351D6A] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_22px_48px_rgba(124,108,255,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_56px_rgba(124,108,255,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1320]"
          >
            <Settings className="h-4 w-4" />
            გახსენი პარამეტრები
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitHubStub;
