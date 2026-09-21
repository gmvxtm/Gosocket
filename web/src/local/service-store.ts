import { groupsApi, requestsApi } from '../api';
import type { LocalStore } from './store';

/** The queue lives in the local service and its PostgreSQL database; this is only the client. */
export const serviceStore: LocalStore = {
  mode: 'service',
  // The service already knows who is calling: it verifies the token on every request.
  setOwner: () => {},
  listProcessors: signal => requestsApi.processors(signal),
  listRequests: signal => requestsApi.list(signal),
  createRequest: input => requestsApi.create(input),
  synchronize: () => requestsApi.synchronize(),
  listGroups: signal => groupsApi.list(signal),
  createGroup: input => groupsApi.create(input),
  countGroup: (id, signal) => groupsApi.total(id, signal),
  synchronizeGroup: id => groupsApi.synchronize(id)
};
