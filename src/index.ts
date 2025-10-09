export { default as AISpaceApp } from './App';
export * from './routes';
export * from './components';
export * from './hooks';
export * from './services';

export const getAISpaceBasePath = () =>
  (import.meta.env?.VITE_AISPACE_BASE as string | undefined) ?? '/admin/ai-developer';

export const AISPACE_BASE_PATH = getAISpaceBasePath();

