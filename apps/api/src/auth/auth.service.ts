import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import {
  DEFAULT_PREFERENCES,
  ErrorCodes,
  isValidTimezone,
  type AuthResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
} from '@nextstep/contracts';
import { CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { ApiError, badRequest, unauthenticated } from '../common/http.js';
import { MailerService } from './mailer.service.js';
import { sha256, TokensService } from './tokens.service.js';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
let dummyHash: Promise<string> | null = null;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private toPublic(u: { id: string; email: string; displayName: string; createdAt: Date }): PublicUser {
    return { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt.toISOString() };
  }

  async register(input: RegisterRequest): Promise<AuthResponse> {
    if (!isValidTimezone(input.timezone)) throw badRequest('Unknown timezone.', [{ path: 'timezone', message: 'Unknown timezone' }]);
    const existing = await this.db.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError(409, ErrorCodes.EMAIL_TAKEN, 'An account with this email already exists. Try signing in.');
    const id = randomUUID();
    const passwordHash = await hash(input.password, ARGON);
    const now = new Date();
    const user = await this.db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { id, email: input.email, passwordHash, displayName: input.displayName, syncRev: 1 } });
      // Preferences id equals the user id, so every device refers to the same singleton record.
      await tx.userPreferences.create({
        data: {
          ...(DEFAULT_PREFERENCES as Record<string, unknown>),
          onboardingCompletedAt: null,
          id,
          userId: id,
          displayName: input.displayName,
          timezone: input.timezone,
          rev: 1,
          fieldRevs: {},
          createdAt: now,
          updatedAt: now,
        } as never,
      });
      return u;
    });
    const tokens = await this.tokens.issue(user.id, input.deviceId);
    return { user: this.toPublic(user), ...tokens };
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    // Verify against a dummy hash when the user doesn't exist so timing doesn't reveal accounts.
    dummyHash ??= hash(randomBytes(16).toString('hex'), ARGON);
    const ok = await verify(user?.passwordHash ?? (await dummyHash), input.password).catch(() => false);
    if (!user || !ok) throw new ApiError(401, ErrorCodes.INVALID_CREDENTIALS, 'That email and password don’t match.');
    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.issue(user.id, input.deviceId);
    return { user: this.toPublic(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { userId, tokens } = await this.tokens.rotate(refreshToken);
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthenticated();
    return { user: this.toPublic(user), ...tokens };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthenticated();
    return this.toPublic(user);
  }

  /** Always responds the same way, whether or not the email exists. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.db.passwordResetToken.create({
      data: { id: randomUUID(), userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    const link = `${this.config.APP_PUBLIC_URL.replace(/\/$/, '')}/reset-password#token=${token}`;
    await this.mailer.sendPasswordReset(user.email, link);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const record = await this.db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired. Request a new one.');
    }
    const passwordHash = await hash(newPassword, ARGON);
    await this.db.$transaction([
      this.db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Sign out everywhere after a reset.
      this.db.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    return verify(user.passwordHash, password).catch(() => false);
  }
}
