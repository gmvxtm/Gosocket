import { browserStore } from './browser-store';
import { serviceStore } from './service-store';
import type { LocalStore } from './store';

/**
 * The queue has to live where the client can actually keep it: on a workstation running the
 * local service and its database, or inside the browser when there is none, such as a phone.
 * The choice is made when the image is built and the rest of the application does not see it.
 */
export const localStore: LocalStore =
  import.meta.env.VITE_LOCAL_STORE === 'browser' ? browserStore : serviceStore;

export type { LocalStore };
