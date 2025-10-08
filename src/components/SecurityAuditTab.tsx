import React from 'react';

const SecurityAuditTab: React.FC = () => (
  <section className="rounded-3xl border border-white/10 bg-[#101628]/85 p-6 text-sm text-[#C8CBE0]">
    <h3 className="text-lg font-semibold text-white">Security Audit</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      აქ განთავსდება უსაფრთხოების აუდიტის შედეგები. მიმდინარე ვერსიაში წარმოდგენილია სადემონსტრაციო მონაცემები.
    </p>
    <ul className="mt-4 space-y-2 text-xs">
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <p className="font-semibold text-emerald-300">TLS configuration</p>
        <p className="text-[#9AA0B5]">ყველა სერვერი იყენებს თანამედროვე ციფრულ ხელმოწერას</p>
      </li>
      <li className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <p className="font-semibold text-amber-300">Access policies</p>
        <p className="text-[#9AA0B5]">რეკომენდირებულია წვდომების პერიოდული გადახედვა</p>
      </li>
    </ul>
  </section>
);

export default SecurityAuditTab;
