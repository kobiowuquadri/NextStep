import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginRequest, LogoutRequest, PasswordResetConfirm, PasswordResetRequest, RefreshRequest, RegisterRequest } from '@nextstep/contracts';
import { CurrentUser, parse, Public } from '../common/http.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';
import { authLimit } from '../throttle.js';

@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  @Public()
  @Throttle(authLimit())
  @Post('register')
  register(@Body() body: unknown) {
    return this.auth.register(parse(RegisterRequest, body));
  }

  @Public()
  @Throttle(authLimit())
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(parse(LoginRequest, body));
  }

  @Public()
  @Throttle(authLimit(30))
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.auth.refresh(parse(RefreshRequest, body).refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const { refreshToken, allDevices } = parse(LogoutRequest, body);
    await this.tokens.revoke(refreshToken, user.id, allDevices);
  }

  @Public()
  @Throttle(authLimit(5))
  @Post('password-reset/request')
  @HttpCode(202)
  async requestReset(@Body() body: unknown) {
    await this.auth.requestPasswordReset(parse(PasswordResetRequest, body).email);
    return { message: 'If an account exists for that email, a reset link is on its way.' };
  }

  @Public()
  @Throttle(authLimit(10))
  @Post('password-reset/confirm')
  @HttpCode(204)
  async confirmReset(@Body() body: unknown) {
    const { token, newPassword } = parse(PasswordResetConfirm, body);
    await this.auth.confirmPasswordReset(token, newPassword);
  }

  @Get('session')
  session(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }
}
