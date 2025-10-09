import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import AIDeveloperPanel from '@aispace/components/AIDeveloperPanel';

const SecretsRoute = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'secrets') {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'secrets');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return <AIDeveloperPanel />;
};

export default SecretsRoute;

