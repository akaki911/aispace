import React from 'react';

const AdminLogs: React.FC = () => (
  <section className="rounded-3xl border border-white/10 bg-[#101828]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Admin Logs</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">სადემონსტრაციო ჩანაწერები ადმინისტრაციული ქმედებებისთვის.</p>
    <ul className="mt-4 space-y-2 text-xs">
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">User gurulo შეიჭრა ასისტენტის მოდულში</li>
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Memory sync trigger განხორციელდა წარმატებით</li>
    </ul>
  </section>
);

export default AdminLogs;
