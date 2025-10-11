import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config';

// Debug utilities - import only in development
if (import.meta.env.DEV) {
  import('./utils/debugTest').catch(err => 
    console.warn('Debug test utilities not available:', err)
  );
}

// Error handling for main entry point
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Failed to find root element');
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render React app:', error);
  // Fallback error display
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: Arial, sans-serif;">
        <h1>Application Error</h1>
        <p>Failed to load the application. Please refresh the page.</p>
        <pre>${String(error)}</pre>
      </div>
    `;
  }
}