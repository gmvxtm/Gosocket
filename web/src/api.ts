export type RequestStatus = 'Pending' | 'Processed' | 'Failed';

export interface LocalRequest {
  id: string;
  name: string;
  type: string;
  payload: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface CreateRequestInput {
  name: string;
  type: string;
  payload: string;
}

export interface SyncResult {
  sent: number;
  failed: { id: string; error: string }[];
  acknowledgements: { id: string; status: RequestStatus; receivedAt: string; alreadyRegistered: boolean }[];
}

const apiBaseUrl = import.meta.env.VITE_SYNC_SERVICE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBaseUrl + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? ('Request failed: HTTP ' + response.status));
  }
  return response.json() as Promise<T>;
}

export const requestsApi = {
  health: (signal?: AbortSignal) => request<{ status: string }>('/health', { signal }),
  processors: (signal?: AbortSignal) => request<string[]>('/processors', { signal }),
  list: (signal?: AbortSignal) => request<LocalRequest[]>('/requests', { signal }),
  create: (input: CreateRequestInput) => request<LocalRequest>('/requests', { method: 'POST', body: JSON.stringify(input) }),
  synchronize: () => request<SyncResult>('/sync', { method: 'POST' })
};
