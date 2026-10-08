import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthRequest } from './security.js';
@Catch()
export class Errors implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message: unknown = 'Não foi possível concluir a operação.';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const obj = body as Record<string, unknown>;
        message = obj.message ?? message;
        code = String(obj.code ?? `HTTP_${status}`);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2004', 'P2034'].includes(exception.code)) {
        status = 409;
        code = 'CONFLICT';
        message = 'Conflito de dados. Atualize e tente novamente.';
      } else if (['P2025', 'P2003'].includes(exception.code)) {
        status = 404;
        code = 'NOT_FOUND';
        message = 'Registro não encontrado no seu escopo.';
      }
    }
    if (status >= 500)
      Logger.error(
        JSON.stringify({
          event: 'request_failed',
          requestId: req.requestId,
          error: exception instanceof Error ? exception.name : 'UnknownError',
        }),
      );
    res.status(status).json({ code, message, requestId: req.requestId });
  }
}
