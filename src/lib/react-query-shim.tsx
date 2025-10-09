import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

export interface QueryClientConfig {
  defaultOptions?: Record<string, unknown>;
}

export class QueryClient {
  constructor(public readonly config?: QueryClientConfig) {}
}

interface QueryClientProviderProps extends PropsWithChildren {
  client: QueryClient;
}

const QueryClientContext = createContext<QueryClient | null>(null);

export const QueryClientProvider = ({ client, children }: QueryClientProviderProps) => (
  <QueryClientContext.Provider value={client}>{children as ReactNode}</QueryClientContext.Provider>
);

export const useQueryClient = () => {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error('QueryClientProvider is missing from the component tree.');
  }
  return client;
};

export type UseQueryResult<TData = unknown> = {
  data: TData | undefined;
  isLoading: boolean;
  error: unknown;
};

export const useQuery = <TData,>(
  _key: unknown,
  _fn: () => Promise<TData>,
): UseQueryResult<TData> => ({ data: undefined, isLoading: false, error: null });
