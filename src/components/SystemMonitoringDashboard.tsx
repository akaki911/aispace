import React from 'react';

interface SystemMonitoringDashboardProps {
  className?: string;
}

const SystemMonitoringDashboard: React.FC<SystemMonitoringDashboardProps> = ({ className }) => (
  <section className={`rounded-3xl border border-white/10 bg-[#0A101F]/85 p-6 text-sm text-[#C8CBE0] ${className ?? ''}`.trim()}>
    <header className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-white">System Monitoring</h3>
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
        Stable
      </span>
    </header>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      რეალურ გარემოში აქ გამოჩნდება CPU, მეხსიერების და სერვისების სტატუსი. დემო რეჟიმში ნაჩვენებია სტაბილური მდგომარეობა.
    </p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#9AA0B5]">CPU Utilization</p>
        <p className="mt-2 text-2xl font-semibold text-white">34%</p>
        <p className="text-[11px] text-[#7B8096]">წინა საათთან შედარებით −6%</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#9AA0B5]">Memory Usage</p>
        <p className="mt-2 text-2xl font-semibold text-white">58%</p>
        <p className="text-[11px] text-[#7B8096]">დაბალანსებული დატვირთვა</p>
      </div>
    </div>
  </section>
);

export default SystemMonitoringDashboard;
