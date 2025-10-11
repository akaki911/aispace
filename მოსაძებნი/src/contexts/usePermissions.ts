import { useContext } from 'react';
import { PermissionsContext } from './PermissionsContextObject';

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
