import type { FC } from 'react';

const SecurityAuditTab: FC = () => {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/75">
      <h3 className="text-xl font-semibold text-white">უსაფრთხოების აუდიტი</h3>
      <p className="mt-3 leading-relaxed text-white/60">
        ეს ტაბი წარმოადგენს დემო ჩანაცვლებას. აქ შეგიძლიათ ინტეგრაცია გაუკეთოთ რეალურ უსაფრთხოების ანგარიშებს, ლოგებს და
        შეტყობინებებს.
      </p>
    </div>
  );
};

export default SecurityAuditTab;
