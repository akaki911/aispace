import { createContext } from 'react';
import type { DebugContextType } from './DebugContext.types';

export const DebugContext = createContext<DebugContextType | undefined>(undefined);
