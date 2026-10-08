import { ContractsController } from './modules/finance/contracts.controller.js';
import 'reflect-metadata';
import {
  Controller,
  Get,
  Global,
  Inject,
  Logger,
  Module,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmetModule from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Database } from './database.js';
import { Errors } from './http/errors.js';
import { Public, RateLimiter, SecurityGuard } from './http/security.js';
import { AuthController } from './modules/auth.js';
import { DirectoryController } from './modules/directory.js';
import { DeliveriesController, DeliveryService } from './modules/deliveries.js';
import { DashboardController } from './modules/dashboard.js';
import { PricingController, PricingService } from './modules/pricing.js';
import { NavigationController, NavigationService } from './modules/navigation.js';
import { RoutingService, MapboxProvider, GoogleProvider } from './modules/routing.js';
@Controller('health')
class HealthController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RateLimiter) private limiter: RateLimiter,
  ) {}
  @Public() @Get('live') live() {
    return { status: 'ok' };
  }
  @Public() @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      await this.limiter.ready();
      await this.limiter.redis.ping();
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Serviço indisponível.',
      });
    }
  }
}
@Global()
@Module({ providers: [Database, RateLimiter], exports: [Database, RateLimiter] })
class CoreModule {}
@Module({
  controllers: [NavigationController],
  providers: [RoutingService, MapboxProvider, GoogleProvider, NavigationService],
  exports: [RoutingService, MapboxProvider, GoogleProvider],
})
class RoutingModule {}
@Module({
  imports: [RoutingModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
class PricingModule {}
@Module({ controllers: [DeliveriesController], providers: [DeliveryService] })
class DeliveriesModule {}
@Module({ controllers: [DirectoryController] })
class DirectoryModule {}
@Module({ controllers: [AuthController] })
class AuthModule {}
@Module({ controllers: [DashboardController] })
class DashboardModule {}
@Module({
  imports: [
    CoreModule,
    RoutingModule,
    PricingModule,
    DeliveriesModule,
    DirectoryModule,
    AuthModule,
    DashboardModule,
  ],
  controllers: [HealthController, ContractsController],
  providers: [
    { provide: APP_GUARD, useClass: SecurityGuard },
    { provide: APP_FILTER, useClass: Errors },
  ],
})
export class AppModule {}
// O builder NestJS da Vercel resolve os tipos do helmet como módulo, não como função.
type HelmetFactory = () => (req: Request, res: Response, next: NextFunction) => void;
const helmet = ((helmetModule as unknown as { default?: HelmetFactory }).default ??
  helmetModule) as unknown as HelmetFactory;
export async function createApplication() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const started = Date.now();
    res.on('finish', () =>
      Logger.log(
        JSON.stringify({
          event: 'request',
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      ),
    );
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Solution Delivery')
      .setDescription(
        'API multiempresa. Mutações exigem Origin e X-CSRF-Token; comandos de entrega, contrato e escala exigem Idempotency-Key.',
      )
      .setVersion('1.0.0')
      .addCookieAuth('sd_session')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/v1/openapi.json' });
  app.enableShutdownHooks();
  return { app, document };
}

// Entrada para Vercel Functions: o builder NestJS espera um export default invocável.
type NodeHandler = (req: Request, res: Response) => void;
let vercelHandler: Promise<NodeHandler> | undefined;
export default async function handler(req: Request, res: Response) {
  vercelHandler ??= createApplication()
    .then(async ({ app }) => {
      await app.init();
      return app.getHttpAdapter().getInstance() as NodeHandler;
    })
    .catch((error: unknown) => {
      vercelHandler = undefined;
      throw error;
    });
  return (await vercelHandler)(req, res);
}
