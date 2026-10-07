const http = require('node:http');
const prefix = '/api/v1';
const courierPath =
  /^\/deliveries\/[a-f0-9-]{36}\/(accept|decline|arrive|collect|complete|navigation)$/;
function allowed(method, path) {
  if (method === 'GET')
    return (
      [
        '/me',
        '/couriers/me',
        '/couriers/me/offers',
        '/deliveries',
        '/dashboard',
        '/health/ready',
      ].includes(path) || /^\/deliveries\/[a-f0-9-]{36}$/.test(path)
    );
  if (method === 'PATCH') return path === '/couriers/me/availability';
  return (
    method === 'POST' &&
    (['/auth/mobile/login', '/auth/password', '/auth/logout'].includes(path) ||
      courierPath.test(path))
  );
}
function createApiProxy(target = 'http://127.0.0.1:8080', request = http.request) {
  const upstream = new URL(target);
  if (
    upstream.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname) ||
    upstream.username ||
    upstream.password ||
    upstream.pathname !== '/' ||
    upstream.search ||
    upstream.hash
  )
    throw new Error('EXPO_API_PROXY_TARGET deve apontar para a API HTTP local.');
  return (req, res, next) => {
    if (!req.url?.startsWith(prefix + '/')) return next();
    const url = new URL(req.url, 'http://localhost');
    const fail = (status, message, code) => {
      if (res.headersSent || res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ message, code }));
    };
    if (req.headers.origin !== undefined || !allowed(req.method, url.pathname.slice(prefix.length)))
      return fail(403, 'Acesso não autorizado.', 'DEV_PROXY_DENIED');
    const headers = {};
    for (const name of ['accept', 'content-type', 'authorization', 'idempotency-key'])
      if (req.headers[name]) headers[name] = req.headers[name];
    const outgoing = request(
      {
        hostname: upstream.hostname.replace('[', '').replace(']', ''),
        port: upstream.port || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers,
      },
      (incoming) => {
        res.statusCode = incoming.statusCode || 502;
        for (const name of ['content-type', 'retry-after', 'x-request-id'])
          if (incoming.headers[name]) res.setHeader(name, incoming.headers[name]);
        res.setHeader('Cache-Control', 'no-store');
        incoming.on('error', () => res.destroy());
        incoming.pipe(res);
      },
    );
    outgoing.on('error', () =>
      fail(
        502,
        'Servidor da empresa indisponível. Tente novamente em instantes.',
        'API_PROXY_UNAVAILABLE',
      ),
    );
    outgoing.setTimeout(10000, () => outgoing.destroy(new Error('API timeout')));
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 65536) {
        fail(413, 'Solicitação muito grande.', 'PAYLOAD_TOO_LARGE');
        req.unpipe(outgoing);
        outgoing.destroy();
      }
    });
    req.on('aborted', () => outgoing.destroy());
    req.on('error', () => outgoing.destroy());
    res.on('close', () => outgoing.destroy());
    req.pipe(outgoing);
  };
}
module.exports = { createApiProxy, allowed };
