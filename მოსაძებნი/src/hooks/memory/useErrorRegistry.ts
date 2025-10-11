import { useRef, useCallback, useState } from 'react';
import { ErrorLog } from '../../types/aimemory';

interface ErrorRegistryAPI {
  registry: Map<string, ErrorLog>;
  add: (error: Partial<ErrorLog>) => void;
  remove: (id: string) => void;
  clearDupes: () => void;
  deletedRef: React.MutableRefObject<Set<string>>;
}

export const useErrorRegistry = (): ErrorRegistryAPI => {
  const registryRef = useRef<Map<string, ErrorLog>>(new Map());
  const deletedErrorsRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  const generateErrorKey = useCallback((error: Partial<ErrorLog>): string => {
    if (error.id) return error.id;
    const keyParts = [
      error.file || 'unknown',
      error.line?.toString() || '0',
      (error.error || '').substring(0, 50)
    ];
    return keyParts.join(':');
  }, []);

  const add = useCallback((error: Partial<ErrorLog>) => {
    const key = generateErrorKey(error);
    
    // Skip if already deleted
    if (deletedErrorsRef.current.has(key)) return;
    
    const fullError: ErrorLog = {
      id: error.id || key,
      file: error.file || 'unknown',
      line: error.line,
      column: error.column,
      error: error.error || 'Unknown error',
      severity: error.severity || 'medium',
      ts: error.ts || Date.now(),
      meta: error.meta
    };

    registryRef.current.set(key, fullError);
    forceUpdate(prev => prev + 1);
  }, [generateErrorKey]);

  const remove = useCallback((id: string) => {
    const key = id;
    registryRef.current.delete(key);
    deletedErrorsRef.current.add(key);
    forceUpdate(prev => prev + 1);
  }, []);

  const clearDupes = useCallback(() => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    
    for (const [key, error] of registryRef.current.entries()) {
      const signature = `${error.file}:${error.line}:${error.error.substring(0, 100)}`;
      if (seen.has(signature)) {
        duplicates.push(key);
      } else {
        seen.add(signature);
      }
    }
    
    duplicates.forEach(key => {
      registryRef.current.delete(key);
      deletedErrorsRef.current.add(key);
    });
    
    if (duplicates.length > 0) {
      forceUpdate(prev => prev + 1);
    }
  }, []);

  return {
    registry: registryRef.current,
    add,
    remove,
    clearDupes,
    deletedRef: deletedErrorsRef
  };
};