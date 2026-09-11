import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApplicationError } from './errors.js';

// One message for every failure: a caller never learns why a token was refused.
const refuse = () => new ApplicationError('Invalid or expired session', 401);

const decode = part => Buffer.from(part, 'base64url');

export function bearerOf(headers) {
  const header = headers.authorization ?? headers.Authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/**
 * Verifies the token issued by the central API, with the key both services share.
 *
 * Doing it here keeps the session usable without connectivity: once the token exists, creating
 * and listing requests never needs the central API again until it expires.
 */
export function verifyToken(token, { secret, issuer, audience, now = () => Date.now(), skewSeconds = 60 }) {
  if (!secret) throw new ApplicationError('The service has no signing key configured', 500);
  if (typeof token !== 'string' || token.length === 0) throw refuse();

  const parts = token.split('.');
  if (parts.length !== 3) throw refuse();
  const [headerPart, payloadPart, signaturePart] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(decode(headerPart).toString('utf8'));
    payload = JSON.parse(decode(payloadPart).toString('utf8'));
  } catch {
    throw refuse();
  }

  // Only the algorithm this service expects: 'none' or a swapped algorithm is a refusal.
  if (header?.alg !== 'HS256') throw refuse();

  const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest();
  const actual = decode(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw refuse();

  const seconds = Math.floor(now() / 1000);
  if (typeof payload.exp === 'number' && seconds > payload.exp + skewSeconds) throw refuse();
  if (typeof payload.nbf === 'number' && seconds + skewSeconds < payload.nbf) throw refuse();
  if (issuer && payload.iss !== issuer) throw refuse();
  if (audience && ![].concat(payload.aud ?? []).includes(audience)) throw refuse();

  return {
    id: payload.sub ?? '',
    username: payload.unique_name ?? '',
    displayName: payload.displayName ?? payload.unique_name ?? ''
  };
}
