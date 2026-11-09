import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiAvailabilityRequest, AiBreakdownRequest, AiCaptureRequest } from '@nextstep/contracts';
import { CurrentUser, parse } from '../common/http.js';
import { AiService } from './ai.service.js';

/** Suggestions only — clients show them for review; nothing here writes student data. */
@Controller('v1/ai')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Post('breakdown')
  @HttpCode(200)
  breakdown(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.ai.breakdown(user.id, parse(AiBreakdownRequest, body));
  }

  @Post('capture')
  @HttpCode(200)
  capture(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.ai.capture(user.id, parse(AiCaptureRequest, body));
  }

  @Post('availability')
  @HttpCode(200)
  availability(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.ai.availability(user.id, parse(AiAvailabilityRequest, body));
  }
}
