import { EventEmitter } from 'node:events';
import { ServiceUnavailableException } from '@nestjs/common';
const unavailable = () =>
  new ServiceUnavailableException({
    code: 'REDIS_UNAVAILABLE',
    message: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  });
/** Minimal Upstash transport for atomic rate limits and readiness. No client-side retry of INCR. */
export class RedisRest extends EventEmitter {
  readonly status = 'ready';
  private readonly origin: string;
  constructor(
    url: string,
    private token: string,
    private fetcher: typeof fetch = fetch,
  ) {
    super();
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== '/' ||
      endpoint.search ||
      endpoint.hash ||
      !token.trim()
    )
      throw new Error('Configure URL HTTPS e token privados válidos do Upstash Redis.');
    this.origin = endpoint.origin;
  }
  async connect(): Promise<void> {
    /* HTTPS requests have no persistent socket. */
  }
  disconnect(): void {
    /* Nothing to close for the REST transport. */
  }
  private async command(args: (string | number)[]): Promise<unknown> {
    try {
      const response = await this.fetcher(this.origin, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!response.ok) throw unavailable();
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || 'error' in data || !('result' in data))
        throw unavailable();
      return data.result;
    } catch {
      throw unavailable();
    }
  }
  async eval(script: string, keys: number, ...args: (string | number)[]): Promise<number> {
    const value = await this.command(['EVAL', script, keys, ...args]);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw unavailable();
    return value;
  }
  async ping(): Promise<string> {
    const value = await this.command(['PING']);
    if (value !== 'PONG') throw unavailable();
    return value;
  }
}
