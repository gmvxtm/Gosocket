import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestsApi } from '../api';

export const localKeys = {
  all: ['local'] as const,
  requests: ['local', 'requests'] as const,
  processors: ['local', 'processors'] as const,
  health: ['local', 'health'] as const
};

export function useRequests() {
  return useQuery({ queryKey: localKeys.requests, queryFn: ({ signal }) => requestsApi.list(signal) });
}

export function useProcessors() {
  return useQuery({ queryKey: localKeys.processors, queryFn: ({ signal }) => requestsApi.processors(signal), staleTime: Infinity });
}

export function useServiceHealth() {
  return useQuery({
    queryKey: localKeys.health,
    queryFn: ({ signal }) => requestsApi.health(signal),
    refetchInterval: 10000
  });
}

export function useCreateRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requestsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: localKeys.requests })
  });
}

export function useSynchronize() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requestsApi.synchronize,
    // A failed later batch may still leave earlier batches confirmed.
    onSettled: () => client.invalidateQueries({ queryKey: localKeys.requests })
  });
}
