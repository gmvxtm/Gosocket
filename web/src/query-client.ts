import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Internet connectivity does not determine availability of the local Node service.
        networkMode: 'always',
        retry: false,
        staleTime: 5000
      },
      mutations: { networkMode: 'always', retry: false }
    }
  });
}
