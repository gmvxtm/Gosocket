import { setTimeout as delay } from 'node:timers/promises';
import { ApplicationError } from './errors.js';
import { outgoingHeaders, withSpan } from './telemetry.js';

export function createBackendClient({ baseUrl, fetchImpl = fetch, wait = delay, timeoutMs = 5000, attempts = 3 }) {
  return {
    async login(credentials) {
      let response;
      try {
        response = await withSpan('POST /auth/login', { 'url.full': `${baseUrl}/auth/login` }, () =>
          fetchImpl(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: outgoingHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify(credentials),
            signal: AbortSignal.timeout(timeoutMs)
          }));
      } catch {
        throw new ApplicationError('The central service is unavailable, sign in again when it is back', 502);
      }
      if (response.status === 401) throw new ApplicationError('Invalid username or password', 401);
      if (!response.ok) throw new ApplicationError(`Login failed: HTTP ${response.status}`, 502);
      return response.json();
    },

    async register(requests, token) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        let transient = true;
        try {
          const response = await withSpan('POST /requests/sync', {
            'http.request.method': 'POST',
            'url.full': `${baseUrl}/requests/sync`,
            'http.request.resend_count': attempt,
            'sync.batch_size': requests.length
          }, () => fetchImpl(`${baseUrl}/requests/sync`, {
            method: 'POST',
            // traceparent travels here, so the central API continues this same trace.
            headers: outgoingHeaders({
              'content-type': 'application/json',
              ...(token ? { authorization: `Bearer ${token}` } : {})
            }),
            body: JSON.stringify(requests),
            signal: AbortSignal.timeout(timeoutMs)
          }));
          transient = response.status === 408 || response.status === 429 || response.status >= 500;
          if (!response.ok) throw new Error(`Backend sync failed: HTTP ${response.status}`);

          const acks = await response.json();
          const sentIds = new Set(requests.map(item => item.id));
          const seen = new Set();
          if (!Array.isArray(acks) || acks.some(ack => {
            if (!ack || !sentIds.has(ack.id) || seen.has(ack.id) || ack.status !== 'Processed') return true;
            seen.add(ack.id);
            return false;
          })) throw new Error('Invalid backend acknowledgement');
          return acks;
        } catch (error) {
          if (!transient || attempt === attempts - 1) {
            throw new ApplicationError(error.message || 'Backend unavailable', 502);
          }
          await wait(200 * (2 ** attempt));
        }
      }
    }
  };
}
