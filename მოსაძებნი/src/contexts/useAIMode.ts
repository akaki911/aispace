import { useContext } from 'react';
import AIModeContext from './AIModeContext';

export const useAIMode = () => {
  const context = useContext(AIModeContext);

  if (!context) {
    throw new Error('useAIMode must be used within an AIModeProvider');
  }

  return context;
};

export default useAIMode;
