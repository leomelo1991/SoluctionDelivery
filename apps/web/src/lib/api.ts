import type { User } from '@solution/contracts';
let csrf = '';
export const setSession = (user: User | null) => {
  csrf = user?.csrfToken ?? '';
};
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const pendingKeys = new Map<string, string>();
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const mutation = method !== 'GET';
  const identity = path + JSON.stringify(body);
  const command =
    mutation &&
    (path.startsWith('/deliveries') || path.startsWith('/contract') || path.startsWith('/finance'));
  let key = pendingKeys.get(identity);
  if (command && !key) {
    key = crypto.randomUUID();
    pendingKeys.set(identity, key!);
  }
  let response: Response;
  try {
    response = await fetch('/api/v1' + path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(mutation ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
        ...(command ? { 'Idempotency-Key': key! } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Falha de conexão. Confira sua rede e tente novamente.');
  }
  const data = await response.json().catch(() => {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      'Resposta inválida do serviço. Atualize e tente novamente.',
    );
  });
  if (!response.ok) {
    if (command && response.status < 500) pendingKeys.delete(identity);
    if (response.status === 401 && path !== '/me' && path !== '/auth/login')
      window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      response.status,
      data.code ?? 'ERROR',
      Array.isArray(data.message)
        ? data.message.join(' · ')
        : (data.message ?? 'Não foi possível concluir a operação.'),
    );
  }
  if (command) pendingKeys.delete(identity);
  return data as T;
}
export function params(values: Record<string, string | number | undefined>) {
  return (
    '?' +
    new URLSearchParams(
      Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
  );
}
