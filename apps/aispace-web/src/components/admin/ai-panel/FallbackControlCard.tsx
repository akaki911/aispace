import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { cardVariants } from './constants';

interface FallbackControlCardProps {
  enabled: boolean;
  forced: boolean;
  provider: string;
  isUpdating: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FallbackControlCard({ enabled, forced, provider, isUpdating, onToggle }: FallbackControlCardProps) {
  const icon = enabled ? <ShieldCheck className="h-6 w-6 text-emerald-400" /> : <ShieldAlert className="h-6 w-6 text-amber-400" />;
  const statusText = enabled ? 'Backup რეჟიმი აქტიურია' : 'Backup რეჟიმი გამორთულია';
  const providerLabel = provider === 'openai' ? 'OpenAI' : 'ლოკალური';

  return (
    <motion.section
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.05 }}
      className="glass-elevated p-6 text-white"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <h3 className="text-lg font-semibold">Use backup mode</h3>
            <p className="text-sm text-[#A0A4AD]">
              როდესაც backup რეჟიმი ჩართულია, პასუხებს იღებთ {providerLabel} მოდელიდან, რათა გურულოსგან ელოდოთ თანმიმდევრულ პასუხებს Groq-ის შეფერხებების დროს.
            </p>
            {forced ? (
              <p className="mt-2 text-xs text-amber-300/80">რეჟიმი იძულებით ჩართულია გარემოს პარამეტრით და ვერ გამოირთვება UI-დან.</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-[#E6E8EC]">
            {statusText}
          </span>
          <button
            type="button"
            disabled={forced || isUpdating}
            onClick={() => onToggle(!enabled)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${
              enabled
                ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
            } ${forced ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isUpdating ? 'იტვირთება…' : enabled ? 'გამორთე backup' : 'ჩართე backup' }
          </button>
        </div>
      </div>
    </motion.section>
  );
}
