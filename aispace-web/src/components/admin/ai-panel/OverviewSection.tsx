import { motion } from 'framer-motion';
import {
  Activity,
  BrainCircuit,
  Flame,
  RefreshCw,
  Save,
  ShieldAlert,
  Upload,
  Users,
} from 'lucide-react';
import type { AdminUserInfo } from './types';
import { cardVariants } from './constants';

interface OverviewSectionProps {
  user: AdminUserInfo | null;
  onSavePrompt: () => void | Promise<void>;
  onBackup: () => Promise<void>;
  onRestore: () => Promise<void>;
  isBackingUp: boolean;
  isRestoring: boolean;
  activeSessionCount: number;
  flaggedSessionCount: number;
  errorCount: number;
  latestUsage: number;
  usageDelta: number;
  averageSessionLength: number;
}

export function OverviewSection({
  user,
  onSavePrompt,
  onBackup,
  onRestore,
  isBackingUp,
  isRestoring,
  activeSessionCount,
  flaggedSessionCount,
  errorCount,
  latestUsage,
  usageDelta,
  averageSessionLength,
}: OverviewSectionProps) {
  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <motion.header
      id="gurulo-section-overview"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-[#7C6CFF2e] bg-[#121622]/90 p-8 text-white shadow-[0_30px_80px_rgba(5,8,20,0.6)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,108,255,0.35),transparent_55%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="flex items-center text-xs font-semibold uppercase tracking-[0.4em] text-[#7C6CFF]">
            <BrainCircuit className="mr-3 h-4 w-4" />
            AI Developer Command
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">ბახმაროს ნეირო-ინჟინერიის საკონტროლო</h1>
          <p className="mt-3 max-w-2xl text-base text-[#A0A4AD]">
            მართეთ პრომპტები, სესიები და ინტეგრაციები ერთიან ნეირო-კონსოლში. ყველა მოდული იყენებს ბახმაროს ჰოლოგრაფიულ UI დიზაინს.
          </p>
        </div>
        <div className="rounded-2xl border border-[#7C6CFF2e] bg-[#181C2A]/80 px-5 py-4 text-xs uppercase tracking-[0.3em] text-[#E6E8EC] shadow-[0_16px_40px_rgba(12,16,32,0.35)] backdrop-blur-xl">
          <p>ტიტული · {user.role}</p>
          <p className="mt-2 text-sm font-semibold normal-case tracking-wide text-white">
            {user.displayName || user.email}
          </p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-3">
        <button
          onClick={onSavePrompt}
          className="holographic-button inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
        >
          <Save className="mr-2 h-4 w-4" />
          პრომპტის შენახვა
        </button>
        <button
          onClick={onBackup}
          className="inline-flex items-center rounded-full border border-[#25D98E3d] bg-[#25D98E1f] px-4 py-2 text-sm font-semibold text-[#25D98E] transition hover:bg-[#25D98E33]"
          disabled={isBackingUp}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isBackingUp ? 'იტვირთება...' : 'სარეზერვო'}
        </button>
        <button
          onClick={onRestore}
          className="inline-flex items-center rounded-full border border-[#7C6CFF3d] bg-[#7C6CFF1f] px-4 py-2 text-sm font-semibold text-[#7C6CFF] transition hover:bg-[#7C6CFF33]"
          disabled={isRestoring}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isRestoring ? 'აღდგენა...' : 'აღდგენა'}
        </button>
      </div>
      <div className="relative mt-8 grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="აქტიური სესიები"
          value={activeSessionCount}
          description={`დღეს: ${latestUsage.toFixed(0)} მონაწილე · ${usageDelta >= 0 ? '+' : ''}${usageDelta.toFixed(0)} ბოლო დღიდან`}
          icon={<Users className="h-5 w-5" />}
          iconWrapper="bg-[#7C6CFF1f] text-[#7C6CFF]"
          borderClass="from-[#7C6CFF66] via-[#351D6A66] to-[#25D98E44]"
        />
        <SummaryCard
          title="საშუალო სესია"
          value={averageSessionLength.toFixed(1)}
          suffix="წთ"
          description="ანალიტიკური პროფილერი ფიქსირებს სტაბილურ ტემპს ბოლო 7 დღეში."
          icon={<Activity className="h-5 w-5" />}
          iconWrapper="bg-[#25D98E1a] text-[#25D98E]"
          borderClass="from-[#25D98E55] via-[#0E1116] to-[#7C6CFF44]"
        />
        <SummaryCard
          title="მონიშნული სესიები"
          value={flaggedSessionCount}
          description="ყოველი მონიშვნა ინახება მოდერაციის გუნდს გადასაცემად."
          icon={<Flame className="h-5 w-5" />}
          iconWrapper="bg-[#E14B8E1f] text-[#E14B8E]"
          borderClass="from-[#E14B8E66] via-[#351D6A66] to-transparent"
        />
        <SummaryCard
          title="დაცვის ლოგები"
          value={errorCount}
          description="აღდგენის პულტი ინახავს ბოლო უსაფრთხოების ტრასებს."
          icon={<ShieldAlert className="h-5 w-5" />}
          iconWrapper="bg-[#FFC94D1a] text-[#FFC94D]"
          borderClass="from-[#351D6A66] via-[#181C2A] to-[#7C6CFF3d]"
        />
      </div>
    </motion.header>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  iconWrapper: string;
  borderClass: string;
  suffix?: string;
}

function SummaryCard({ title, value, description, icon, iconWrapper, borderClass, suffix }: SummaryCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br ${borderClass} p-[1px] shadow-[0_16px_45px_rgba(10,14,32,0.55)]`}
    >
      <div className="relative rounded-[18px] bg-[#121622]/95 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#A0A4AD]">{title}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {value}
              {suffix ? <span className="ml-1 text-sm font-medium text-[#A0A4AD]">{suffix}</span> : null}
            </p>
          </div>
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${iconWrapper}`}>{icon}</span>
        </div>
        <p className="mt-3 text-xs text-[#A0A4AD]">{description}</p>
      </div>
    </div>
  );
}
