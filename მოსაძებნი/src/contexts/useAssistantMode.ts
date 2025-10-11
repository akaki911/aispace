import { useContext } from 'react';
import AssistantModeContext from './AssistantModeContext';

export const useAssistantMode = () => {
  const context = useContext(AssistantModeContext);

  if (!context) {
    throw new Error('useAssistantMode must be used within an AssistantModeProvider');
  }

  return context;
};

export default useAssistantMode;
