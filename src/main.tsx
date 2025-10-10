import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import type { SWRConfiguration } from 'swr';

import { AISpaceApp } from '@aispace';
import '@/index.css';
import '@/i18n/config';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsProvider';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { AssistantModeProvider } from '@/contexts/AssistantModeContext';
import { AIModeProvider } from '@/contexts/AIModeContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const ensureSWRConfig = (parent?: SWRConfiguration): SWRConfiguration => ({
  ...parent,
  isPaused: parent?.isPaused ?? (() => false),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const raw = import.meta.env.VITE_AISPACE_BASE ?? '/';
const basename = raw && raw !== '/' ? ('/' + raw).replace(/\/+/g, '/').replace(/\/+$/, '') : '/';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <SWRConfig value={ensureSWRConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AIModeProvider>
            <AssistantModeProvider>
              <AuthProvider>
                <FeatureFlagsProvider>
                  <PermissionsProvider>
                    <BrowserRouter basename={basename}>
                      <AISpaceApp />
                    </BrowserRouter>
                  </PermissionsProvider>
                </FeatureFlagsProvider>
              </AuthProvider>
            </AssistantModeProvider>
          </AIModeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SWRConfig>
  </StrictMode>,
);
