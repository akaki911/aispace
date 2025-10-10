import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AIDeveloperRoute, GurulaRoute, NotFoundRoute, SecretsRoute } from './routes';
import { useAuth } from '@/contexts/useAuth';

const DemoMessage = ({ onLogin }: { onLogin?: () => void }) => (
  <div className="flex h-full flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center">
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">AI დეველოპერის პანელი</h1>
      <p className="text-sm leading-relaxed text-slate-300">
        ეს დემო ვერ უერთდება საწარმოს აუთენტიფიკაციას, ამიტომ "დეველოპერის" ხედისათვის არ
        ხორციელდება ავტომატური ავტორიზაცია. რეალურ გარემოში ამ ეკრანზე მხოლოდ შესაბამისი როლის
        მქონე მომხმარებლები მოხვდებიან.
      </p>
      <p className="text-xs leading-relaxed text-slate-500">
        ამ ინსტალაციაში შეგიძლიათ უბრალოდ დაათვალიეროთ ინტერფეისი — ავტორიზაციის გარეშე ფუნქციონალი
        მიუწვდომელია და სწორედ ამიტომ ცარიელი გვერდი ჩნდებოდა. ადმინისტრატორის სისტემასთან მიერთების
        გარეშე დამატებითი ნაბიჯების შესრულება საჭირო არ არის.
      </p>
      {onLogin ? (
        <button
          type="button"
          onClick={onLogin}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Sign in with Enterprise (Azure AD)
        </button>
      ) : null}
    </div>
  </div>
);

const AISpaceApp = () => {
  const { isSuperAdmin, isLoading, authInitialized, login } = useAuth();

  if (!authInitialized || isLoading) {
    return <div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>;
  }

  if (!isSuperAdmin) {
    return <DemoMessage onLogin={() => void login()} />;
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>}>
      <Routes>
        <Route index element={<Navigate to="developer" replace />} />
        <Route path="developer" element={<AIDeveloperRoute />} />
        <Route path="developer/secrets" element={<SecretsRoute />} />
        <Route path="developer/gurula" element={<GurulaRoute />} />
        <Route path="developer/*" element={<AIDeveloperRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </Suspense>
  );
};

export default AISpaceApp;

