import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { WaitlistRequest } from '@nextstep/contracts';
import { parse, Public } from '../common/http.js';
import { PrismaService } from '../prisma.service.js';
import { authLimit } from '../throttle.js';

/** The website's "Join the waitlist" form. */
@Controller('v1/waitlist')
export class WaitlistController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /**
   * Adds an email once. The answer is the same whether or not it was already on the list,
   * so the endpoint can't be used to find out who signed up.
   */
  @Public()
  @Throttle(authLimit(10))
  @Post()
  @HttpCode(201)
  async join(@Body() body: unknown) {
    const { email } = parse(WaitlistRequest, body);
    await this.db.waitlistEntry.upsert({ where: { email }, create: { id: randomUUID(), email }, update: {} });
    return { message: 'You’re on the list. We’ll email you when NextStep is ready.' };
  }
}
