import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupsApi, requestsApi } from '../api';

export const localKeys = {
  all: ['local'] as const,
  requests: ['local', 'requests'] as const,
  processors: ['local', 'processors'] as const,
  health: ['local', 'health'] as const,
  groups: ['local', 'groups'] as const,
  groupTotal: (id: string) => ['local', 'groups', id, 'total'] as const
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
    // Returning the promise would hold the mutation open until the list refetches, and the
    // screen would wait on a refresh it does not need to show the request it just created.
    onSuccess: () => { void client.invalidateQueries({ queryKey: localKeys.requests }); }
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

export function useGroups() {
  return useQuery({ queryKey: localKeys.groups, queryFn: ({ signal }) => groupsApi.list(signal) });
}

// The total walks the whole tree, so the service owns the arithmetic instead of the browser.
export function useGroupTotals(ids: string[]) {
  const results = useQueries({
    queries: ids.map(id => ({
      queryKey: localKeys.groupTotal(id),
      queryFn: ({ signal }: { signal?: AbortSignal }) => groupsApi.total(id, signal)
    }))
  });
  return new Map(ids.map((id, index) => [id, results[index]?.data?.total]));
}

export function useCreateGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: localKeys.groups })
  });
}

export function useSynchronizeGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.synchronize,
    onSettled: () => client.invalidateQueries({ queryKey: localKeys.all })
  });
}
