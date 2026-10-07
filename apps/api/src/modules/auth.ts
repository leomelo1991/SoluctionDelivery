import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Database } from '../database.js';
import { config } from '../config.js';
import { Public, NativeLogin, digest, type AuthRequest } from '../http/security.js';
import { LoginDto, PasswordDto } from '../http/dto.js';
const dummyPasswordHash = argon2.hash(randomBytes(32).toString('hex'));
const publicUser = (u: AuthRequest['actor']) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  tenantId: u.tenantId,
  establishmentId: u.establishmentId,
  courierId: u.courierId,
  mustChangePassword: u.mustChangePassword,
});
@ApiTags('Autenticação')
@Controller()
export class AuthController {
  constructor(@Inject(Database) private db: Database) {}
  private async authenticate(body: LoginDto, channel: 'web' | 'mobile') {
    const tenant = await this.db.tenant.findUnique({
      where: { slug: body.tenant.trim().toLowerCase() },
    });
    const user = tenant?.active
      ? await this.db.user.findUnique({
          where: {
            tenantId_email: { tenantId: tenant.id, email: body.email.trim().toLowerCase() },
          },
        })
      : null;
    const valid = await argon2.verify(
      user?.passwordHash ?? (await dummyPasswordHash),
      body.password,
    );
    if (!user || !valid || !user.active || (channel === 'mobile' && user.role !== 'courier'))
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Empresa, e-mail ou senha inválidos.',
      });
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.db.session.create({
      data: {
        tokenHash: digest(token),
        csrfToken,
        channel,
        userId: user.id,
        tenantId: user.tenantId,
        expiresAt,
      },
    });
    return { token, expiresAt, user: { ...publicUser(user), csrfToken, tenantName: tenant!.name } };
  }
  @Public() @NativeLogin() @Post('auth/mobile/login') async mobileLogin(@Body() body: LoginDto) {
    const session = await this.authenticate(body, 'mobile');
    return { accessToken: session.token, expiresAt: session.expiresAt, user: session.user };
  }
  @Public() @Post('auth/login') async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authenticate(body, 'web');
    res.cookie('sd_session', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return user;
  }
  @Get('me') async me(@Req() req: AuthRequest) {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: req.actor.tenantId } });
    return { ...publicUser(req.actor), csrfToken: req.csrfToken, tenantName: tenant.name };
  }
  @Post('auth/logout') async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie('sd_session', { path: '/' });
    return { ok: true };
  }
  @Post('auth/password') async password(@Req() req: AuthRequest, @Body() body: PasswordDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.actor.id } });
    if (!(await argon2.verify(user.passwordHash, body.currentPassword)))
      throw new ForbiddenException({ code: 'INVALID_PASSWORD', message: 'Senha atual incorreta.' });
    if (body.currentPassword === body.newPassword)
      throw new ForbiddenException({
        code: 'PASSWORD_UNCHANGED',
        message: 'Escolha uma nova senha.',
      });
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(body.newPassword), mustChangePassword: false },
      });
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: req.sessionId } } });
      await tx.auditEvent.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entity: 'user',
          entityId: user.id,
          action: 'password_changed',
          changes: {},
        },
      });
    });
    return { ok: true };
  }
}
