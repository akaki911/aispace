import React from 'react';

const AutoUpdateMonitoringDashboard: React.FC = () => (
  <section className="rounded-3xl border border-white/10 bg-[#0D1426]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Auto Update Monitoring</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      ეს განყოფილება ასახავს გურულოს ავტომატური განახლებების მიმდინარეობას. ინტეგრაციის გარეშე ნაჩვენებია დემო სტატუსი.
    </p>
    <div className="mt-4 space-y-2 text-xs">
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <p className="font-semibold text-emerald-300">Scheduler</p>
        <p className="text-[#9AA0B5]">უკანასკნელი განახლება 12 წუთის წინ</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <p className="font-semibold text-sky-300">Vector index</p>
        <p className="text-[#9AA0B5]">ბოლო სინქი წარმატებით დასრულდა</p>
      </div>
    </div>
  </section>
);

export default AutoUpdateMonitoringDashboard;
