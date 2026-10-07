import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleDestroy,
  SetMetadata,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Redis } from 'ioredis';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Database } from '../database.js';
import { config } from '../config.js';
import { RedisRest } from '../modules/redis-rest.js';
export interface Actor {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'admin' | 'establishment' | 'courier';
  establishmentId: string | null;
  courierId: string | null;
  mustChangePassword: boolean;
}
export interface AuthRequest extends Request {
  actor: Actor;
  sessionId: string;
  requestId: string;
  csrfToken: string;
}
export const Public = () => SetMetadata('public', true);
export const NativeLogin = () => SetMetadata('nativeLogin', true);
export const Roles = (...roles: Actor['role'][]) => SetMetadata('roles', roles);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  namespace = 'sd';
  readonly redis =
    config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN
      ? new RedisRest(config.UPSTASH_REDIS_REST_URL, config.UPSTASH_REDIS_REST_TOKEN)
      : new Redis(config.REDIS_URL!, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
  constructor() {
    this.redis.on('error', () => undefined);
  }
  private connecting: Promise<void> | null = null;
  async ready() {
    if (this.redis.status === 'ready') return;
    if (!this.connecting) {
      this.connecting = (
        ['wait', 'end'].includes(this.redis.status)
          ? this.redis.connect()
          : new Promise<void>((resolve, reject) => {
              const finish = (error?: Error) => {
                clearTimeout(timer);
                this.redis.off('ready', onReady);
                this.redis.off('error', onError);
                if (error) reject(error);
                else resolve();
              };
              const onReady = () => finish();
              const onError = (error: Error) => finish(error);
              const timer = setTimeout(() => finish(new Error('Redis connection timeout')), 5000);
              this.redis.once('ready', onReady);
              this.redis.once('error', onError);
            })
      ).finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
  }
  async hit(key: string, limit: number) {
    await this.ready();
    const count = Number(
      await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `${this.namespace}:${key}`,
      ),
    );
    if (count > limit)
      throw new HttpException(
        { code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde um minuto.' },
        429,
      );
  }
  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Reflector) private reflector: Reflector,
    @Inject(RateLimiter) private limiter: RateLimiter,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const nativeLogin = this.reflector.getAllAndOverride<boolean>('nativeLogin', [
      context.getHandler(),
      context.getClass(),
    ]);
    const bearer = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const nativeRequest = isPublic ? Boolean(nativeLogin) : Boolean(bearer);
    if (
      (nativeRequest && req.headers.origin !== undefined) ||
      (mutation && !nativeRequest && req.headers.origin !== config.APP_ORIGIN)
    )
      throw new ForbiddenException({ code: 'ORIGIN_DENIED', message: 'Origem não autorizada.' });
    if (isPublic) {
      if (!req.path.includes('/health'))
        await this.limiter.hit(
          `public:${req.ip}:${req.path.endsWith('/login') ? 'login' : 'api'}`,
          req.path.endsWith('/login') ? 10 : 180,
        );
      return true;
    }
    const token = bearer ?? req.cookies?.sd_session;
    if (typeof token !== 'string') {
      await this.limiter.hit(`unauthorized:${req.ip}`, 180);
      throw new UnauthorizedException();
    }
    const session = await this.db.session.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active)
      throw new UnauthorizedException();
    if (
      session.channel !== (bearer ? 'mobile' : 'web') ||
      (bearer && session.user.role !== 'courier')
    )
      throw new UnauthorizedException();
    const tenant = await this.db.tenant.findUnique({ where: { id: session.tenantId } });
    if (!tenant?.active) throw new UnauthorizedException();
    const { passwordHash: _passwordHash, ...actor } = session.user;
    await this.limiter.hit(`user:${actor.tenantId}:${actor.id}`, 180);
    if (req.path.endsWith('/pricing/quotes'))
      await this.limiter.hit(`quotes:${actor.tenantId}:${actor.id}`, 10);
    if (/\/deliveries\/[^/]+\/navigation$/.test(req.path))
      await this.limiter.hit(`navigation:${actor.tenantId}:${actor.id}`, 10);
    req.actor = actor;
    req.sessionId = session.id;
    req.csrfToken = session.csrfToken;
    if (mutation && !bearer && !equal(String(req.headers['x-csrf-token'] ?? ''), session.csrfToken))
      throw new ForbiddenException({
        code: 'CSRF_DENIED',
        message: 'Sessão inválida. Entre novamente.',
      });
    if (
      actor.mustChangePassword &&
      !['/api/v1/me', '/api/v1/auth/password', '/api/v1/auth/logout'].includes(req.path)
    )
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Altere sua senha inicial.',
      });
    const roles = this.reflector.getAllAndOverride<Actor['role'][]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(actor.role)) throw new ForbiddenException();
    return true;
  }
}
