import { motion } from 'framer-motion';
import { Activity, ShieldAlert } from 'lucide-react';
import { cardVariants } from './constants';
import type { TrendData } from './types';
import { BarTrendChart, LineTrendChart } from './TrendCharts';

interface AnalyticsSectionProps {
  usageTrend: TrendData;
  sessionTrend: TrendData;
  errorLogs: string[];
}

export function AnalyticsSection({ usageTrend, sessionTrend, errorLogs }: AnalyticsSectionProps) {
  const latestUsage = usageTrend.values[usageTrend.values.length - 1] ?? 0;
  const latestSessionLength = sessionTrend.values[sessionTrend.values.length - 1] ?? 0;

  return (
    <section id="gurulo-section-analytics" className="grid gap-6 scroll-mt-28 lg:grid-cols-2">
      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">ანალიტიკა და გამოყენება</h3>
          <Activity className="h-5 w-5 text-[#25D98E]" />
        </div>
        <div className="mt-6 space-y-6">
          <AnalyticsCard
            title="დღიური აქტიური სესიები"
            value={`${latestUsage} სესია`}
            badge="7 დღიანი დინამიკა"
          >
            <LineTrendChart labels={usageTrend.labels} values={usageTrend.values} />
          </AnalyticsCard>
          <AnalyticsCard
            title="სესიის საშუალო ხანგრძლივობა"
            value={`${latestSessionLength.toFixed(1)} წუთი`}
            badge="7 დღიანი დინამიკა"
          >
            <BarTrendChart labels={sessionTrend.labels} values={sessionTrend.values} />
          </AnalyticsCard>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">შეცდომების ჟურნალი</h3>
          <ShieldAlert className="h-5 w-5 text-[#E14B8E]" />
        </div>
        <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-2 text-sm">
          {errorLogs.length === 0 ? (
            <div className="rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/80 px-4 py-3 text-[#A0A4AD]">
              ბოლო პერიოდში შეცდომა არ დაფიქსირებულა.
            </div>
          ) : (
            errorLogs.map((log) => (
              <div
                key={log}
                className="rounded-2xl border border-[#E14B8E40] bg-[#2B1428]/80 px-4 py-3 text-[#FFC1D8] shadow-[0_14px_32px_rgba(16,6,18,0.45)]"
              >
                {log}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </section>
  );
}

interface AnalyticsCardProps {
  title: string;
  value: string;
  badge: string;
  children: React.ReactNode;
}

function AnalyticsCard({ title, value, badge, children }: AnalyticsCardProps) {
  return (
    <div className="rounded-3xl border border-[#7C6CFF2e] bg-[#181C2A]/80 p-4">
      <div className="flex items-center justify-between pb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#6F7280]">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-[#7C6CFF]">{value}</p>
        </div>
        <span className="rounded-full border border-[#7C6CFF3d] bg-[#1A1F2F]/80 px-3 py-1 text-xs text-[#7C6CFF]">{badge}</span>
      </div>
      {children}
    </div>
  );
}
