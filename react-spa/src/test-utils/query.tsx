import type { PropsWithChildren, ReactElement } from 'react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';

function mergeDefaultOptions(config?: QueryClientConfig): QueryClientConfig['defaultOptions'] {
  return {
    ...config?.defaultOptions,
    queries: {
      retry: false,
      gcTime: 0,
      ...config?.defaultOptions?.queries,
    },
    mutations: {
      retry: false,
      gcTime: 0,
      ...config?.defaultOptions?.mutations,
    },
  };
}

export function createTestQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: mergeDefaultOptions(config),
  });
}

export function createQueryClientWrapper(config?: QueryClientConfig): {
  queryClient: QueryClient;
  wrapper: ({ children }: PropsWithChildren) => ReactElement;
} {
  const queryClient = createTestQueryClient(config);

  return {
    queryClient,
    wrapper: function QueryClientWrapper({ children }: PropsWithChildren) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    },
  };
}

export function renderWithQueryClient(ui: ReactElement, config?: QueryClientConfig) {
  const { queryClient, wrapper } = createQueryClientWrapper(config);

  return {
    queryClient,
    ...render(ui, { wrapper }),
  };
}

export function renderHookWithQueryClient<TResult>(
  renderCallback: () => TResult,
  config?: QueryClientConfig
) {
  const { queryClient, wrapper } = createQueryClientWrapper(config);

  return {
    queryClient,
    ...renderHook(renderCallback, { wrapper }),
  };
}
