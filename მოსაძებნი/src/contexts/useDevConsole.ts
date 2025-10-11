import { useContext } from 'react';
import { DevConsoleContext } from './DevConsoleContextObject';

export const useDevConsole = () => {
  const context = useContext(DevConsoleContext);
  if (!context) {
    throw new Error('useDevConsole must be used within a DevConsoleProvider');
  }
  return context;
};
