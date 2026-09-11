import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { bearerOf, verifyToken } from '../src/auth.js';

const session = { secret: 'clave-de-prueba', issuer: 'request-hub', audience: 'offline-requests' };
const now = () => Date.UTC(2026, 8, 10, 12, 0, 0);
const seconds = Math.floor(now() / 1000);

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function sign(payload, { secret = session.secret, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const body = `${encode(header)}.${encode(payload)}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

const validPayload = {
  sub: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
  unique_name: 'gino',
  displayName: 'Gino Maguina',
  iss: session.issuer,
  aud: session.audience,
  nbf: seconds - 60,
  exp: seconds + 3600
};

test('a token signed with the shared key identifies the user', () => {
  const user = verifyToken(sign(validPayload), { ...session, now });

  assert.deepEqual(user, { id: validPayload.sub, username: 'gino', displayName: 'Gino Maguina' });
});

test('the authorization header is only read as a bearer token', () => {
  assert.equal(bearerOf({ authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi');
  assert.equal(bearerOf({ authorization: 'Basic dXNlcjpwYXNz' }), '');
  assert.equal(bearerOf({}), '');
});

test('a token signed with another key is refused', () => {
  const token = sign(validPayload, { secret: 'otra-clave' });

  assert.throws(() => verifyToken(token, { ...session, now }), { statusCode: 401 });
});

test('a tampered payload is refused because the signature no longer matches', () => {
  const [header, , signature] = sign(validPayload).split('.');
  const forged = `${header}.${encode({ ...validPayload, unique_name: 'otro' })}.${signature}`;

  assert.throws(() => verifyToken(forged, { ...session, now }), { statusCode: 401 });
});

test('an unsigned token is refused instead of trusted', () => {
  // The classic 'alg: none' attack: the service only accepts the algorithm it expects.
  const body = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(validPayload)}`;

  assert.throws(() => verifyToken(`${body}.`, { ...session, now }), { statusCode: 401 });
});

test('expiry and issuer are checked', () => {
  const expired = sign({ ...validPayload, exp: seconds - 3600 });
  const foreign = sign({ ...validPayload, iss: 'otro-emisor' });
  const wrongAudience = sign({ ...validPayload, aud: 'otra-app' });

  assert.throws(() => verifyToken(expired, { ...session, now }), { statusCode: 401 });
  assert.throws(() => verifyToken(foreign, { ...session, now }), { statusCode: 401 });
  assert.throws(() => verifyToken(wrongAudience, { ...session, now }), { statusCode: 401 });
});

test('a token that just expired is still accepted inside the clock skew', () => {
  const justExpired = sign({ ...validPayload, exp: seconds - 30 });

  assert.equal(verifyToken(justExpired, { ...session, now }).username, 'gino');
});

test('garbage never reaches the payload', () => {
  for (const value of ['', 'abc', 'a.b', 'a.b.c.d', null, undefined, 42]) {
    assert.throws(() => verifyToken(value, { ...session, now }), { statusCode: 401 });
  }
});
