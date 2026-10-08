const value = process.env.API_ORIGIN;
if (!value) throw new Error('Configure API_ORIGIN com a URL HTTPS do projeto NestJS na Vercel.');
const api = new URL(value);
if (
  api.protocol !== 'https:' ||
  api.username ||
  api.password ||
  api.pathname !== '/' ||
  api.search ||
  api.hash
)
  throw new Error('API_ORIGIN deve conter somente a origem HTTPS da API, sem /api/v1.');
export default {
  framework: 'vite',
  installCommand: 'corepack pnpm install --frozen-lockfile',
  buildCommand: 'corepack pnpm build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${api.origin}/api/:path*` },
    { source: '/((?!api/|assets/).*)', destination: '/index.html' },
  ],
  headers: [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
};
