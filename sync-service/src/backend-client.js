import { setTimeout as delay } from 'node:timers/promises';
import { ApplicationError } from './errors.js';

export function createBackendClient({ baseUrl, fetchImpl = fetch, wait = delay, timeoutMs = 5000, attempts = 3 }) {
  return {
    async register(requests) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        let transient = true;
        try {
          const response = await fetchImpl(`${baseUrl}/requests/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(requests),
            signal: AbortSignal.timeout(timeoutMs)
          });
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
