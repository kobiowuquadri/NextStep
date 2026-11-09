import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, unauthenticated, type AuthedRequest } from '../common/http.js';
import { TokensService } from './tokens.service.js';

/** Every route requires a valid access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      if (isPublic) return true;
      throw unauthenticated();
    }
    try {
      const user = await this.tokens.verifyAccess(header.slice(7));
      // Logout, password reset and account deletion revoke the session immediately.
      if (!(await this.tokens.isSessionActive(user.sid))) throw unauthenticated('Your session has ended. Please sign in again.');
      req.user = user;
      return true;
    } catch (e) {
      if (isPublic) return true;
      throw e;
    }
  }
}
