import type { PropsWithChildren } from 'react';

export const DevConsoleProvider = ({ children }: PropsWithChildren): JSX.Element => {
  return <>{children}</>;
};

export default DevConsoleProvider;
