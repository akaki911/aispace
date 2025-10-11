import { createContext } from 'react';
import type { PermissionsContextType } from './PermissionsContext.types';

export const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);
