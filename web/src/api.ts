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

export type GroupItemKind = 'request' | 'group';

export interface GroupItem {
  kind: GroupItemKind;
  id: string;
}

export interface LocalGroup {
  id: string;
  name: string;
  items: GroupItem[];
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
  items: GroupItem[];
}

export interface Credentials {
  username: string;
  password: string;
}

export interface Session {
  token: string;
  expiresAt: string;
  username: string;
  displayName: string;
}

/** Thrown when the service refuses the session, so the app can send the user back to the login. */
export class UnauthorizedError extends Error {}

const apiBaseUrl = import.meta.env.VITE_SYNC_SERVICE_URL ?? 'http://localhost:3001';

// The token lives in this module and not in a header built at every call site: the session owns it.
let accessToken = '';

export function setAccessToken(token: string) {
  accessToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBaseUrl + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: 'Bearer ' + accessToken } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.error ?? ('Request failed: HTTP ' + response.status);
    if (response.status === 401) throw new UnauthorizedError(message);
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (credentials: Credentials) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  session: (signal?: AbortSignal) =>
    request<{ id: string; username: string; displayName: string }>('/session', { signal })
};

/** What a client that keeps its own queue hands over for processing and forwarding. */
export interface OutboxRequest {
  id: string;
  name: string;
  type: string;
  payload: string;
  createdAt: string;
}

export const requestsApi = {
  health: (signal?: AbortSignal) => request<{ status: string }>('/health', { signal }),
  processors: (signal?: AbortSignal) => request<string[]>('/processors', { signal }),
  list: (signal?: AbortSignal) => request<LocalRequest[]>('/requests', { signal }),
  create: (input: CreateRequestInput) => request<LocalRequest>('/requests', { method: 'POST', body: JSON.stringify(input) }),
  synchronize: () => request<SyncResult>('/sync', { method: 'POST' }),
  syncBatch: (requests: OutboxRequest[]) =>
    request<SyncResult>('/sync/batch', { method: 'POST', body: JSON.stringify({ requests }) })
};

export const groupsApi = {
  list: (signal?: AbortSignal) => request<LocalGroup[]>('/groups', { signal }),
  create: (input: CreateGroupInput) => request<LocalGroup>('/groups', { method: 'POST', body: JSON.stringify(input) }),
  total: (id: string, signal?: AbortSignal) => request<{ total: number }>('/groups/' + id + '/total', { signal }),
  synchronize: (id: string) => request<SyncResult>('/groups/' + id + '/sync', { method: 'POST' })
};
