import React from 'react';

const BackupTab: React.FC<{ hasDevConsoleAccess?: boolean }> = () => (
  <section className="rounded-3xl border border-white/10 bg-[#0D1628]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Backup Management</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      გურულოს სარეზერვო ასლების მართვის პანელი. დემო რეჟიმში გამოყენებულია სტატიკური ინფორმაცია.
    </p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#9AA0B5]">ბოლო სარეზერვო ასლი</p>
        <p className="mt-2 text-lg font-semibold text-white">{new Date().toLocaleString('ka-GE')}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#9AA0B5]">სტატუსი</p>
        <p className="mt-2 text-lg font-semibold text-emerald-300">Active</p>
      </div>
    </div>
  </section>
);

export default BackupTab;
