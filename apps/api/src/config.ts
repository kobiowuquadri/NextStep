import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** At least 32 random bytes, base64 or hex. Used to sign access tokens (HS256). */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('nextstep-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
  /** Comma-separated list of allowed browser origins. Mobile apps don't send Origin. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** Public URL of the app/web for password reset links. */
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(120),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  // Mail (optional). Without SMTP, reset emails are not sent; dev mode logs the link.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('NextStep <no-reply@example.com>'),
  // AI (optional). Without a key every AI route returns AI_NOT_CONFIGURED and the apps use manual flows.
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  AI_DAILY_LIMIT_PER_USER: z.coerce.number().int().min(0).default(20),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached && env === process.env) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && /change-me|example|secret/i.test(parsed.data.JWT_SECRET)) {
    throw new Error('JWT_SECRET looks like a placeholder. Generate a random secret for production.');
  }
  if (env === process.env) cached = parsed.data;
  return parsed.data;
}

export const CONFIG = Symbol('CONFIG');
