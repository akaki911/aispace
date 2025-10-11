import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AIDeveloperRoute, GurulaRoute, NotFoundRoute, SecretsRoute } from './routes';
import { useAuth } from '@/contexts/useAuth';

const LoginMessage = ({ onLogin }: { onLogin: () => void }) => (
  <div className="flex h-full flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center">
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">AI დეველოპერის პანელი</h1>
      <p className="text-sm leading-relaxed text-slate-300">
        საწარმოს ანგარიშით შესვლა აუცილებელია დეველოპერის ინსტრუმენტების გამოსაყენებლად. გთხოვთ,
        გამოიყენოთ Azure AD ავტორიზაცია.
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Sign in with Enterprise (Azure AD)
      </button>
    </div>
  </div>
);

const NoAccessMessage = () => (
  <div className="flex h-full flex-1 items-center justify-center bg-slate-950 p-6 text-center">
    <div className="space-y-4 text-slate-200">
      <h1 className="text-xl font-semibold">დაშვება შეზღუდულია</h1>
      <p className="text-sm text-slate-400">თქვენს ანგარიშს არ გააჩნია სუპერადმინისტრატორის უფლებები.</p>
    </div>
  </div>
);

const AISpaceApp = () => {
  const { isSuperAdmin, isLoading, authInitialized, session, startEnterpriseLogin } = useAuth();

  if (!authInitialized || isLoading) {
    return <div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>;
  }

  if (!session) {
    return <LoginMessage onLogin={() => void startEnterpriseLogin()} />;
  }

  if (!isSuperAdmin) {
    return <NoAccessMessage />;
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

