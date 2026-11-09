import { loadConfig } from './config.js';

/** Per-route stricter limits for authentication endpoints (per IP, per minute). Relaxed in tests unless TEST_RATE_LIMITS is set. */
export function authLimit(perMinute?: number) {
  const relaxed = process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS;
  const limit = relaxed ? 10_000 : (perMinute ?? loadConfig().AUTH_RATE_LIMIT_PER_MINUTE);
  return { default: { limit, ttl: 60_000 } };
}
