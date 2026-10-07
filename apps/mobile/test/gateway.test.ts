import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { once } from 'node:events';
import type { ClientRequest, IncomingMessage, ServerResponse, RequestOptions } from 'node:http';
import { resolveApiUrl } from '../src/core/api-url';
const require = createRequire(import.meta.url);
const { createApiProxy, allowed } = require('../scripts/dev-api-proxy.cjs') as {
  allowed: (method: string, path: string) => boolean;
  createApiProxy: (
    target?: string,
    request?: (
      options: RequestOptions,
      callback: (incoming: IncomingMessage) => void,
    ) => ClientRequest,
  ) => (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
};
const base = {
  configured: 'http://172.23.101.135:8080/api/v1',
  development: true,
  expoGo: true,
  tunnel: true,
  allowHttp: true,
};
test('Expo Go uses the actual tunnel for API calls instead of the private WSL IP', () => {
  assert.equal(
    resolveApiUrl({ ...base, hostUri: 'project.exp.direct:80' }),
    'https://project.exp.direct/api/v1',
  );
  assert.equal(
    resolveApiUrl({ ...base, hostUri: 'project.exp.direct:443' }),
    'https://project.exp.direct/api/v1',
  );
  assert.equal(
    resolveApiUrl({ ...base, hostUri: '192.168.1.10:8082', tunnel: false }),
    'http://192.168.1.10:8082/api/v1',
  );
});
test('a personal Ngrok domain uses HTTPS even when Expo starts in LAN mode', () => {
  assert.equal(
    resolveApiUrl({ ...base, tunnel: false, hostUri: 'demo.ngrok-free.dev:80' }),
    'https://demo.ngrok-free.dev/api/v1',
  );
  assert.equal(
    resolveApiUrl({ ...base, tunnel: false, hostUri: 'demo.ngrok.app:443' }),
    'https://demo.ngrok.app/api/v1',
  );
});

test('standalone builds use configured API URL and never use the development gateway', () => {
  assert.equal(
    resolveApiUrl({
      ...base,
      configured: 'https://delivery.example.test/api/v1',
      hostUri: 'project.exp.direct',
      development: false,
      allowHttp: false,
    }),
    'https://delivery.example.test/api/v1',
  );
  assert.throws(() => resolveApiUrl({ ...base, development: false, allowHttp: false }));
});
test('gateway permits courier operations and blocks browser/admin/unrelated paths', () => {
  assert.equal(allowed('POST', '/auth/mobile/login'), true);
  assert.equal(allowed('POST', '/deliveries/12345678-1234-1234-1234-123456789012/accept'), true);
  assert.equal(
    allowed('POST', '/deliveries/12345678-1234-1234-1234-123456789012/navigation'),
    true,
  );
  assert.equal(
    allowed('GET', '/deliveries/12345678-1234-1234-1234-123456789012/navigation'),
    false,
  );
  assert.equal(allowed('POST', '/auth/login'), false);
  assert.equal(allowed('POST', '/deliveries'), false);
  assert.equal(allowed('GET', '/users'), false);
  assert.throws(() => createApiProxy('http://remote.example.test:8080'));
});
function response() {
  const chunks: Buffer[] = [];
  const headers: Record<string, unknown> = {};
  const res = Object.assign(
    new Writable({
      write(chunk, _encoding, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
    }),
    {
      statusCode: 200,
      setHeader(name: string, value: unknown) {
        headers[name] = value;
      },
      writeHead(status: number, values: Record<string, unknown>) {
        this.statusCode = status;
        Object.assign(headers, values);
      },
    },
  );
  return { res: res as unknown as ServerResponse, chunks, headers };
}
test('gateway streams native login payload and response while dropping cookies', async () => {
  const req = Object.assign(new PassThrough(), {
    url: '/api/v1/auth/mobile/login',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      cookie: 'browser-cookie',
      'idempotency-key': 'command-id',
    },
  }) as unknown as IncomingMessage & PassThrough;
  const reply = response();
  const requestBody: Buffer[] = [];
  let forwarded: RequestOptions | undefined;
  const proxy = createApiProxy(undefined, (options, callback) => {
    forwarded = options;
    const outgoing = new Writable({
      write(chunk, _encoding, done) {
        requestBody.push(Buffer.from(chunk));
        done();
      },
    }) as unknown as ClientRequest;
    outgoing.setTimeout = () => outgoing;
    outgoing.on('finish', () => {
      const incoming = Object.assign(new PassThrough(), {
        statusCode: 201,
        headers: { 'content-type': 'application/json', 'set-cookie': ['should-not-forward'] },
      }) as unknown as IncomingMessage & PassThrough;
      callback(incoming);
      incoming.end(JSON.stringify({ accessToken: 'test', user: { role: 'courier' } }));
    });
    return outgoing;
  });
  proxy(req, reply.res, () => assert.fail('Unexpected Metro fallback'));
  const completed = once(reply.res, 'finish');
  req.end('{"tenant":"demo"}');
  await completed;
  assert.equal(forwarded?.hostname, '127.0.0.1');
  assert.equal(forwarded?.port, '8080');
  assert.equal((forwarded?.headers as Record<string, string>).authorization, 'Bearer test-token');
  assert.equal((forwarded?.headers as Record<string, string>).cookie, undefined);
  assert.equal(Buffer.concat(requestBody).toString(), '{"tenant":"demo"}');
  assert.equal(reply.res.statusCode, 201);
  assert.equal(reply.headers['set-cookie'], undefined);
  assert.equal(JSON.parse(Buffer.concat(reply.chunks).toString()).user.role, 'courier');
});
test('gateway reports backend connection failures as JSON instead of losing the request', async () => {
  const req = Object.assign(new PassThrough(), {
    url: '/api/v1/me',
    method: 'GET',
    headers: {},
  }) as unknown as IncomingMessage & PassThrough;
  const reply = response();
  const proxy = createApiProxy(undefined, () => {
    const outgoing = new PassThrough() as unknown as ClientRequest;
    outgoing.setTimeout = () => outgoing;
    queueMicrotask(() => outgoing.emit('error', new Error('ECONNREFUSED')));
    return outgoing;
  });
  const completed = once(reply.res, 'finish');
  proxy(req, reply.res, () => assert.fail());
  req.end();
  await completed;
  assert.equal(reply.res.statusCode, 502);
  assert.equal(JSON.parse(Buffer.concat(reply.chunks).toString()).code, 'API_PROXY_UNAVAILABLE');
});
test('browser Origin is denied and Metro bundles pass through unchanged', () => {
  const proxy = createApiProxy();
  const reply = response();
  proxy(
    Object.assign(new PassThrough(), {
      url: '/api/v1/auth/mobile/login',
      method: 'POST',
      headers: { origin: 'https://example.test' },
    }) as unknown as IncomingMessage & PassThrough,
    reply.res,
    () => assert.fail(),
  );
  assert.equal(reply.res.statusCode, 403);
  let next = false;
  proxy(
    Object.assign(new PassThrough(), {
      url: '/index.bundle?platform=android',
      method: 'GET',
      headers: {},
    }) as unknown as IncomingMessage & PassThrough,
    response().res,
    () => {
      next = true;
    },
  );
  assert.equal(next, true);
});
