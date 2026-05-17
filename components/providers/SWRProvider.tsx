"use client";

import { SWRConfig } from "swr";

type Props = {
  children: React.ReactNode;
};

export function AppSWRProvider({ children }: Props) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 30_000,
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
