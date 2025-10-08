import { motion } from 'framer-motion';
import { Download, FileCode2, Flame, KeyRound, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { cardVariants } from './constants';

interface IntegrationsSectionProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  isRotatingKey: boolean;
  onRotateKey: () => Promise<void>;
  onQuickAction: (message: string) => void;
}

export function IntegrationsSection({ apiKey, onApiKeyChange, isRotatingKey, onRotateKey, onQuickAction }: IntegrationsSectionProps) {
  return (
    <section id="gurulo-section-integrations" className="grid gap-6 scroll-mt-28 lg:grid-cols-2">
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">ინტეგრაციების პარამეტრები</h3>
          <SlidersHorizontal className="h-5 w-5 text-[#7C6CFF]" />
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-xs uppercase tracking-[0.3em] text-[#6F7280]">API გასაღები</label>
          <div className="flex items-center gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              className="flex-1 rounded-2xl border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-3 py-2 text-sm text-[#E6E8EC] focus:outline-none focus:ring-2 focus:ring-[#7C6CFF80]"
            />
            <button
              onClick={onRotateKey}
              className="inline-flex items-center rounded-full border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-3 py-2 text-xs font-semibold text-[#E6E8EC] transition hover:bg-[#242B3F]"
              disabled={isRotatingKey}
            >
              <KeyRound className="mr-2 h-4 w-4" /> {isRotatingKey ? 'ჩართვა...' : 'როტაცია'}
            </button>
          </div>
          <div className="rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/80 p-4 text-sm text-[#E6E8EC]">
            <p className="font-semibold text-white">დაცვა</p>
            <p className="mt-1 text-[#A0A4AD]">
              გასაღები შენახულია დაშიფრული სახით. რეგენერაციისას ძველი გასაღები ავტომატურად იბლოკება 60 წამში.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">სწრაფი მოქმედებები</h3>
          <FileCode2 className="h-5 w-5 text-[#7C6CFF]" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <QuickActionButton
            label="SDK სინქი"
            description="განაახლეთ კლიენტის SDK-ები ბოლოს დაყენებული კონფიგურაციით"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => onQuickAction('SDK სინქრონიზაცია ინიცირებულია')}
          />
          <QuickActionButton
            label="Shadow Deploy"
            description="ტესტური გარემოში ჩართეთ ახალი მოდელები მომხმარებლის გარეშე"
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => onQuickAction('Shadow deployment მოდული გააქტიურდა')}
          />
          <QuickActionButton
            label="Voice Blueprint"
            description="ჩატვირთეთ რეკომენდებული ხმის პარამეტრები"
            icon={<Download className="h-4 w-4" />}
            onClick={() => onQuickAction('Voice blueprint გადმოწერილია')}
          />
          <QuickActionButton
            label="Cloud Profiler"
            description="გაანალიზეთ ანიმაციების შესრულება რეალურ დროში"
            icon={<Flame className="h-4 w-4" />}
            onClick={() => onQuickAction('Cloud Drift profiler ჩაირთო')}
          />
        </div>
      </motion.div>
    </section>
  );
}

interface QuickActionButtonProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function QuickActionButton({ label, description, icon, onClick }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/80 px-4 py-3 text-left text-sm text-white transition hover:-translate-y-1 hover:bg-[#1F2435]"
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-xs text-[#A0A4AD]">{description}</p>
    </button>
  );
}
