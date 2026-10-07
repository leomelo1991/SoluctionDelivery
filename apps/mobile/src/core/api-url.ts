import { validateApiUrl } from './client';
export function resolveApiUrl({
  configured,
  hostUri,
  development,
  expoGo,
  tunnel,
  allowHttp,
}: {
  configured?: string;
  hostUri?: string;
  development: boolean;
  expoGo: boolean;
  tunnel: boolean;
  allowHttp: boolean;
}): string {
  if (development && expoGo && hostUri) {
    const url = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['http:', 'https:'].includes(url.protocol)
    )
      throw new Error('Endereço de desenvolvimento inválido.');
    // Expo manifests omit the URL scheme. Its integrated tunnels use HTTPS.
    if (
      tunnel ||
      url.hostname.endsWith('.exp.direct') ||
      url.hostname.endsWith('.ngrok-free.app') ||
      url.hostname.endsWith('.ngrok-free.dev') ||
      url.hostname.endsWith('.ngrok.app') ||
      url.hostname.endsWith('.ngrok.io')
    ) {
      url.protocol = 'https:';
      if (url.port === '80') url.port = '';
    }
    return `${url.origin}/api/v1`;
  }
  return validateApiUrl(configured, allowHttp);
}
