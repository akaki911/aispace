import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import type { SWRConfiguration } from 'swr';

import { AISpaceApp, AISPACE_BASE_PATH } from '@aispace';
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

const normaliseBasePath = (basePath: string | undefined): string => {
  if (!basePath) {
    return '/';
  }

  let trimmed = basePath.endsWith('/*') ? basePath.slice(0, -2) : basePath;
  if (!trimmed.startsWith('/')) {
    trimmed = `/${trimmed}`;
  }

  while (trimmed.length > 1 && trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed || '/';
};

const routerBasePath = normaliseBasePath(AISPACE_BASE_PATH);

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
                    <BrowserRouter basename={routerBasePath}>
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
