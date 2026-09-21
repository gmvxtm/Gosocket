import { createServer } from 'node:http';
import { ApplicationError } from './errors.js';
import { bearerOf, verifyToken } from './auth.js';
import { setSpanUser, withIncomingContext, withSpan } from './telemetry.js';

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization'
  });
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 512 * 1024) throw new ApplicationError('Request body too large', 413);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ApplicationError('A JSON object is required');
  }
}

// Identifiers collapse into a placeholder so the trace groups by route, not by resource.
function routeOf(method, pathname) {
  return method + ' ' + pathname.replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/{id}');
}

export function createHttpServer({ application, backendUrl, session, logger = console }) {
  async function dispatch(request, response, pathname) {
    try {
      if (request.method === 'OPTIONS') return json(response, 204);

      if (request.method === 'GET' && pathname === '/health') {
        try {
          await application.health();
          return json(response, 200, { status: 'Healthy', backendUrl, database: 'PostgreSQL' });
        } catch {
          return json(response, 503, { status: 'Unhealthy', database: 'PostgreSQL' });
        }
      }
      if (request.method === 'POST' && pathname === '/auth/login') return json(response, 200, await application.login(await readBody(request)));

      // Everything below needs a session. The token is verified here, with no call to the
      // central API, so the app keeps working while there is no connectivity.
      const token = bearerOf(request.headers);
      const user = verifyToken(token, session);
      setSpanUser(user.username);

      if (request.method === 'GET' && pathname === '/session') return json(response, 200, user);
      if (request.method === 'GET' && pathname === '/processors') return json(response, 200, application.listProcessors());
      if (request.method === 'GET' && pathname === '/requests') return json(response, 200, await application.listRequests());
      if (request.method === 'POST' && pathname === '/requests') return json(response, 201, await application.createRequest(await readBody(request)));
      if (request.method === 'POST' && pathname === '/sync') return json(response, 200, await application.synchronize(null, token));
      // Clients that keep the queue in the browser send it here: this route stores nothing.
      if (request.method === 'POST' && pathname === '/sync/batch') return json(response, 200, await application.synchronizeBatch(await readBody(request), token));
      if (request.method === 'GET' && pathname === '/groups') return json(response, 200, await application.listGroups());
      if (request.method === 'POST' && pathname === '/groups') return json(response, 201, await application.createGroup(await readBody(request)));

      const requestMatch = pathname.match(/^\/requests\/([^/]+)$/);
      if (request.method === 'GET' && requestMatch) return json(response, 200, await application.getRequest(requestMatch[1]));
      const groupMatch = pathname.match(/^\/groups\/([^/]+)\/(total|sync)$/);
      if (groupMatch?.[2] === 'total' && request.method === 'GET') return json(response, 200, await application.countGroup(groupMatch[1]));
      if (groupMatch?.[2] === 'sync' && request.method === 'POST') return json(response, 200, await application.synchronizeGroup(groupMatch[1], token));
      return json(response, 404, { error: 'Not found' });
    } catch (error) {
      if (error instanceof ApplicationError) return json(response, error.statusCode, { error: error.message });
      logger.error({ event: 'request_failed', method: request.method, error });
      return json(response, 500, { error: 'Unexpected service error' });
    }
  }

  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');

    // The container probes this every few seconds: tracing it would bury the real traffic.
    if (pathname === '/health') return dispatch(request, response, pathname);

    await withIncomingContext(request.headers, () =>
      withSpan(routeOf(request.method, pathname), {
        'http.request.method': request.method,
        'url.path': pathname
      }, async span => {
        await dispatch(request, response, pathname);
        span.setAttribute('http.response.status_code', response.statusCode);
      }));
  });
}
