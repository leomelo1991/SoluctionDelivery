import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateDeployment(config, environment = process.env) {
  const destination = config.rewrites?.find((rule) => rule.source === '/api/:path*')?.destination;
  const suffix = '/api/:path*';
  if (typeof destination !== 'string' || !destination.endsWith(suffix))
    throw new Error('Defina o destino HTTPS literal da API em apps/web/vercel.json.');
  const origin = destination.slice(0, -suffix.length);
  const api = new URL(origin);
  if (
    api.protocol !== 'https:' ||
    api.username ||
    api.password ||
    api.pathname !== '/' ||
    api.search ||
    api.hash
  )
    throw new Error(
      'O destino da API deve usar uma origem HTTPS sem credenciais ou caminhos adicionais.',
    );
  for (const name of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']) {
    const domain = environment[name];
    if (domain && new URL(`https://${domain}`).host === api.host)
      throw new Error(
        'O proxy da API aponta para o próprio painel. Configure em apps/web/vercel.json o domínio do projeto backend, cujo Root Directory é apps/api.',
      );
  }
  return api.origin;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    validateDeployment(config);
    console.log('Configuração estática do proxy validada.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
