import { createContext } from 'react';
import type { DevConsoleContextType } from './DevConsoleContext.types';

export const DevConsoleContext = createContext<DevConsoleContextType | null>(null);
