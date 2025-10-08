import { createElement } from 'react';
import ReactDOM from 'react-dom/client';

import AISpaceApp from './App';

export { default as AISpaceApp } from './App';
export * from '@aispace/routes';
export * from '@aispace/components';
export * from '@aispace/hooks';
export * from '@aispace/services';

export const getAISpaceBasePath = () =>
  (import.meta.env?.VITE_AISPACE_BASE as string | undefined) ?? '/admin/ai-developer';

export const AISPACE_BASE_PATH = getAISpaceBasePath();

if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(createElement(AISpaceApp));
  }
}
