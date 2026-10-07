export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function validateApiUrl(value: string | undefined, allowHttp: boolean): string {
  if (!value)
    throw new Error('Configure EXPO_PUBLIC_API_URL para conectar o aplicativo à sua empresa.');
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol) ||
    (!allowHttp && url.protocol !== 'https:')
  )
    throw new Error(
      'Use uma URL HTTPS válida para a API. HTTP é permitido apenas em desenvolvimento.',
    );
  return value.replace(/\/$/, '');
}
interface Options {
  token?: string;
  fetcher?: typeof fetch;
  unauthorized?: () => void;
  key?: () => string;
}
export class ApiClient {
  private pending = new Map<string, string>();
  constructor(
    private url: string,
    private options: Options = {},
  ) {}
  async request<T>(path: string, method = 'GET', body?: object, idempotent = false): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Endpoint inválido.');
    const fingerprint = `${method}:${path}:${JSON.stringify(body)}`;
    let key = this.pending.get(fingerprint);
    if (idempotent && !key) {
      if (!this.options.key) throw new Error('Gerador de identificadores indisponível.');
      key = this.options.key();
      this.pending.set(fingerprint, key);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await (this.options.fetcher ?? fetch)(this.url + path, {
        method,
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(this.options.token ? { Authorization: `Bearer ${this.options.token}` } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new ApiError(502, 'Resposta inválida do servidor. Tente novamente.');
      }
      if (response.ok || (response.status >= 400 && response.status < 500))
        this.pending.delete(fingerprint);
      if (!response.ok) {
        if (response.status === 401 && this.options.token) this.options.unauthorized?.();
        const error = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
        throw new ApiError(
          response.status,
          typeof error.message === 'string'
            ? error.message
            : 'Não foi possível concluir. Atualize e tente novamente.',
          typeof error.code === 'string' ? error.code : undefined,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        0,
        'Sem conexão ou servidor indisponível. Verifique a internet e tente novamente.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
