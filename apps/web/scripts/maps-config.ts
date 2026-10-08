/** Only explicitly public browser keys may enter the frontend bundle. */
export function browserMapsKey(environment: Record<string, string | undefined>): string {
  const key =
    environment.VITE_GOOGLE_MAPS_KEY?.trim() || environment.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
  if (key && (key.includes('=') || /\s/.test(key))) {
    throw new Error(
      'A variável pública do Google Maps deve conter somente a chave, sem nome da variável, espaços ou quebras de linha.',
    );
  }
  if (!key && environment.VERCEL === '1') {
    throw new Error(
      'Mapa sem chave no build do PAINEL. Defina VITE_GOOGLE_MAPS_KEY no projeto frontend da Vercel, no ambiente deste deployment (Production ou Preview), e refaça o deploy. GOOGLE_MAPS_KEY é exclusiva do backend.',
    );
  }
  return key;
}
