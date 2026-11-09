import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';
import { ErrorCodes } from '@nextstep/contracts';
import { CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { unauthenticated } from '../common/http.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/**
 * Access tokens: short-lived HS256 JWTs.
 * Refresh tokens: opaque random values, stored only as SHA-256 hashes, rotated
 * on every use. Presenting an already-rotated token revokes the whole family
 * (likely theft), forcing a fresh sign-in on every device that shared it.
 */
@Injectable()
export class TokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService) private readonly db: PrismaService,
  ) {
    this.key = new TextEncoder().encode(config.JWT_SECRET);
  }

  async issue(userId: string, deviceId?: string | null, familyId: string = randomUUID()): Promise<IssuedTokens> {
    const now = Date.now();
    const accessExp = new Date(now + this.config.ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = await new SignJWT({ sid: familyId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience('nextstep-clients')
      .setIssuedAt()
      .setExpirationTime(Math.floor(accessExp.getTime() / 1000))
      .setJti(randomUUID())
      .sign(this.key);
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExp = new Date(now + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.db.refreshToken.create({
      data: { id: randomUUID(), userId, tokenHash: sha256(refreshToken), familyId, deviceId: deviceId ?? null, expiresAt: refreshExp },
    });
    return { accessToken, accessTokenExpiresAt: accessExp.toISOString(), refreshToken, refreshTokenExpiresAt: refreshExp.toISOString() };
  }

  async verifyAccess(token: string): Promise<{ id: string; sid: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: this.config.JWT_ISSUER, audience: 'nextstep-clients', algorithms: ['HS256'] });
      if (!payload.sub || typeof payload.sid !== 'string') throw unauthenticated('Invalid token');
      return { id: payload.sub, sid: payload.sid };
    } catch (e) {
      if (e instanceof errors.JWTExpired) throw unauthenticated('Your session expired', ErrorCodes.TOKEN_EXPIRED);
      throw unauthenticated('Invalid token');
    }
  }

  async rotate(refreshToken: string): Promise<{ userId: string; tokens: IssuedTokens }> {
    const hash = sha256(refreshToken);
    const record = await this.db.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record) throw unauthenticated('Invalid refresh token');
    if (record.revokedAt) {
      // Reuse of a rotated token: revoke the entire family.
      await this.db.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthenticated('This sign-in is no longer valid. Please sign in again.');
    }
    if (record.expiresAt.getTime() < Date.now()) throw unauthenticated('Your session expired', ErrorCodes.TOKEN_EXPIRED);
    const tokens = await this.issue(record.userId, record.deviceId, record.familyId);
    const next = await this.db.refreshToken.findUnique({ where: { tokenHash: sha256(tokens.refreshToken) } });
    const res = await this.db.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date(), replacedBy: next?.id, lastUsedAt: new Date() } });
    if (res.count === 0) {
      // Lost a race with a concurrent refresh using the same token: treat as reuse.
      await this.db.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthenticated('This sign-in is no longer valid. Please sign in again.');
    }
    return { userId: record.userId, tokens };
  }

  async revoke(refreshToken: string, userId: string, allDevices = false) {
    if (allDevices) {
      await this.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return;
    }
    await this.db.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Refresh-token families double as session ids; a revoked family invalidates its access tokens too. */
  async isSessionActive(familyId: string): Promise<boolean> {
    const live = await this.db.refreshToken.count({ where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } } });
    return live > 0;
  }
}
