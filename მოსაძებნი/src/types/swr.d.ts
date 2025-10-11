import type { FC, PropsWithChildren } from 'react';

declare module 'swr' {
  export type SWRKey = string | any[] | null;

  export interface SWRConfiguration<Data = any, Error = any> {
    refreshInterval?: number | ((data: Data | undefined) => number);
    revalidateOnFocus?: boolean;
    isPaused?: () => boolean;
    onErrorRetry?: (
      err: Error,
      key: string,
      config: SWRConfiguration<Data, Error>,
      revalidate: (opts?: { retryCount?: number }) => void,
      opts: { retryCount: number },
    ) => void;
    [key: string]: unknown;
  }

  export interface SWRResponse<Data = any, Error = any> {
    data: Data | undefined;
    error: Error | undefined;
    mutate: (data?: Data | Promise<Data>, shouldRevalidate?: boolean) => Promise<Data | undefined>;
    isLoading: boolean;
    isValidating: boolean;
  }

  export const SWRConfig: FC<
    PropsWithChildren<{
      value?:
        | SWRConfiguration<any, any>
        | ((parentConfig?: SWRConfiguration<any, any>) => SWRConfiguration<any, any>);
    }>
  > & {
    defaultValue?: SWRConfiguration<any, any>;
  };

  export default function useSWR<Data = any, Error = any>(
    key: SWRKey,
    fetcher?: (...args: any[]) => Promise<Data>,
    config?: SWRConfiguration<Data, Error>,
  ): SWRResponse<Data, Error>;
}
