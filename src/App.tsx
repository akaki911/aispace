import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AIDeveloperRoute, GurulaRoute, SecretsRoute } from '@aispace/routes';

const AISpaceApp = () => {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">AI სივრცე იტვირთება...</div>}>
      <Routes>
        <Route index element={<Navigate to="developer" replace />} />
        <Route path="developer" element={<AIDeveloperRoute />} />
        <Route path="developer/secrets" element={<SecretsRoute />} />
        <Route path="developer/gurula" element={<GurulaRoute />} />
        <Route path="developer/*" element={<AIDeveloperRoute />} />
      </Routes>
    </Suspense>
  );
};

export default AISpaceApp;
