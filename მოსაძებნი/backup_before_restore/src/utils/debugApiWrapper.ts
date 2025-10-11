
// Standalone API logger without DebugContext dependency
export const createApiLogger = (componentName: string) => {
  return {
    logApiCall: async <T>(
      method: string,
      url: string,
      apiCall: () => Promise<T>
    ): Promise<T> => {
      const startTime = Date.now();
      
      try {
        const result = await apiCall();
        const responseTime = Date.now() - startTime;
        console.log(`[API][${componentName}] ${method} ${url} → 200 (${responseTime}ms)`);
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
        console.log(`[API][${componentName}] ${method} ${url} → ${status} (${responseTime}ms)`);
        console.error(`[API][${componentName}] API call failed: ${method} ${url}`, { error: error instanceof Error ? error.message : error });
        throw error;
      }
    }
  };
};
