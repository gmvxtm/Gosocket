import type {
  CreateGroupInput,
  CreateRequestInput,
  LocalGroup,
  LocalRequest,
  SyncResult
} from '../api';

/**
 * Where the pending work is kept while there is no connectivity. One implementation delegates
 * to the local service, the other keeps the queue inside the browser.
 */
export interface LocalStore {
  readonly mode: 'service' | 'browser';
  /** Rows belong to the account that created them; the service infers it from the token instead. */
  setOwner(username: string): void;
  listProcessors(signal?: AbortSignal): Promise<string[]>;
  listRequests(signal?: AbortSignal): Promise<LocalRequest[]>;
  createRequest(input: CreateRequestInput): Promise<LocalRequest>;
  synchronize(): Promise<SyncResult>;
  listGroups(signal?: AbortSignal): Promise<LocalGroup[]>;
  createGroup(input: CreateGroupInput): Promise<LocalGroup>;
  countGroup(id: string, signal?: AbortSignal): Promise<{ total: number }>;
  synchronizeGroup(id: string): Promise<SyncResult>;
}
