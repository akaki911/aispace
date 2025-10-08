import React from 'react';

interface AutoImproveTraceMonitorProps {
  className?: string;
}

const AutoImproveTraceMonitor: React.FC<AutoImproveTraceMonitorProps> = ({ className }) => (
  <div className={`rounded-3xl border border-white/10 bg-[#0B1220]/80 p-6 text-sm text-[#C8CBE0] ${className ?? ''}`.trim()}>
    <h3 className="text-lg font-semibold text-white">Auto Improve Trace Monitor</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      რეალური გარემოს გარეშე ეს პანელი აჩვენებს დემო მონაცემებს. ინტეგრაციისას აქ გამოჩნდება ბოლო ავტომატური გაუმჯობესების
      სესიები და სტატუსები.
    </p>
    <ul className="mt-4 space-y-2 text-xs">
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <span className="font-semibold text-emerald-300">RUN-001</span>
        <p className="text-[#A0A4AD]">Refined onboarding flow — წარმატებით დასრულებული 2 წუთში</p>
      </li>
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <span className="font-semibold text-amber-300">RUN-002</span>
        <p className="text-[#A0A4AD]">Security audit fallback — დგას წვერზე, მოითხოვს დეველოპერის დადასტურებას</p>
      </li>
    </ul>
  </div>
);

export default AutoImproveTraceMonitor;
