const { getDefaultConfig } = require('expo/metro-config');
const { createApiProxy } = require('./scripts/dev-api-proxy.cjs');
const config = getDefaultConfig(__dirname);
const enhance = config.server.enhanceMiddleware;
const proxy = createApiProxy(process.env.EXPO_API_PROXY_TARGET);
config.server.enhanceMiddleware = (middleware, server) => {
  const metro = enhance ? enhance(middleware, server) : middleware;
  return (req, res, next) => proxy(req, res, () => metro(req, res, next));
};
module.exports = config;
