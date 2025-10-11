import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import type { SWRConfiguration } from 'swr';
import App from './App';
import './index.css';
import './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsProvider';

const ensureSWRConfig: (parent?: SWRConfiguration) => SWRConfiguration = (parentConfig) => ({
  ...parentConfig,
  isPaused: parentConfig?.isPaused ?? (() => false),
});

const systemVerificationModulePromise = import('./utils/systemVerification').catch(error => {
  console.warn('⚠️ System verification utilities not available:', error);
  return null;
});

// Debug utilities - import only in development
if (import.meta.env.DEV) {
  import('./utils/debugTest').catch(err =>
    console.warn('Debug test utilities not available:', err)
  );

  // Expose cache clearing utility globally
  systemVerificationModulePromise.then(module => {
    if (!module) return;
    (window as any).clearAllCaches = module.clearAllCaches;
    console.log('🧹 Cache clearing utility available: clearAllCaches()');
  });
}

// Enhanced global error handling
window.addEventListener('error', (event) => {
  console.error('🚨 [GLOBAL] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 [GLOBAL] Unhandled promise rejection:', event.reason);
});

// Error handling for main entry point
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Failed to find root element');
  throw new Error('Root element not found');
}

try {
  console.log('🚀 [MAIN] Starting React application...');
  createRoot(rootElement).render(
    <StrictMode>
      <SWRConfig value={ensureSWRConfig}>
        <AuthProvider>
          <FeatureFlagsProvider>
            <App />
          </FeatureFlagsProvider>
        </AuthProvider>
      </SWRConfig>
    </StrictMode>
  );
  console.log('✅ [MAIN] React application started successfully');
} catch (error) {
  console.error('❌ [MAIN] Failed to render React app:', error);
  // Fallback error display
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: 'Noto Sans Georgian', 'Inter', 'Manrope', sans-serif; letter-spacing: 0.015em; background: #fff; min-height: 100vh;">
        <h1>🚨 Application Error</h1>
        <p>Failed to load the application. Please try the following:</p>
        <ol>
          <li>Refresh the page</li>
          <li>Clear browser cache and cookies</li>
          <li>Try in incognito mode</li>
        </ol>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
          🔄 Refresh Page
        </button>
        <details style="margin-top: 20px;">
          <summary>Technical Details</summary>
          <pre style="background: #f1f1f1; padding: 10px; border-radius: 5px; overflow: auto;">${String(error)}</pre>
        </details>
      </div>
    `;
  }
}