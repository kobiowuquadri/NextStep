import { z } from 'zod';
import { IsoDateTime, TaskKind } from './entities.js';

export const API_VERSION = 'v1';

export const Email = z.email().max(254).transform((e) => e.trim().toLowerCase());
/** Passphrases are encouraged: length matters more than symbols. */
export const Password = z.string().min(10, 'Use at least 10 characters').max(128);

export const RegisterRequest = z.object({
  email: Email,
  password: Password,
  displayName: z.string().trim().min(1).max(60),
  timezone: z.string().min(1).max(64),
  deviceId: z.string().min(8).max(64).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  email: Email,
  password: z.string().min(1).max(128),
  deviceId: z.string().min(8).max(64).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const RefreshRequest = z.object({ refreshToken: z.string().min(20).max(200) });
export const LogoutRequest = z.object({ refreshToken: z.string().min(20).max(200), allDevices: z.boolean().optional() });
export const PasswordResetRequest = z.object({ email: Email });
export const PasswordResetConfirm = z.object({ token: z.string().min(20).max(200), newPassword: Password });

export const PublicUser = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: IsoDateTime,
});
export type PublicUser = z.infer<typeof PublicUser>;

export const AuthResponse = z.object({
  user: PublicUser,
  accessToken: z.string(),
  accessTokenExpiresAt: IsoDateTime,
  refreshToken: z.string(),
  refreshTokenExpiresAt: IsoDateTime,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

/** Stable machine-readable error codes shared by API and clients. */
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  STALE_PREVIEW: 'STALE_PREVIEW',
  CONFLICT: 'CONFLICT',
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_LIMIT_REACHED: 'AI_LIMIT_REACHED',
  INTERNAL: 'INTERNAL',
} as const;

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
  updatedSince: IsoDateTime.optional(),
  includeDeleted: z.coerce.boolean().optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ─── Optional AI assistance ────────────────────────────────────────────────

export const AiBreakdownRequest = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional(),
  kind: TaskKind.optional(),
  estimatedMinutes: z.number().int().min(5).max(6000).optional(),
});
export const AiBreakdownResponse = z.object({
  steps: z
    .array(z.object({ title: z.string().trim().min(1).max(140), estimatedMinutes: z.number().int().min(5).max(600) }))
    .min(1)
    .max(10),
  note: z.string().max(300).optional(),
});
export type AiBreakdownResponse = z.infer<typeof AiBreakdownResponse>;

export const AiCaptureRequest = z.object({
  text: z.string().trim().min(3).max(1000),
  timezone: z.string().min(1).max(64),
  now: IsoDateTime,
  courseTitles: z.array(z.string().max(100)).max(30).optional(),
});
/** Draft only: every field is confirmed by the student before anything is saved. */
export const AiCaptureResponse = z.object({
  title: z.string().trim().min(1).max(140),
  kind: TaskKind,
  dueAtLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
  estimatedMinutes: z.number().int().min(5).max(6000).nullable(),
  courseTitle: z.string().max(100).nullable(),
  importance: z.number().int().min(1).max(4).nullable(),
  needsConfirmation: z.array(z.string().max(120)).max(6),
});
export type AiCaptureResponse = z.infer<typeof AiCaptureResponse>;

export const AiAvailabilityRequest = z.object({
  text: z.string().trim().min(3).max(1000),
  timezone: z.string().min(1).max(64),
  now: IsoDateTime,
});
/** Structured interpretation of "I only have an hour tonight" — becomes a Recovery Mode input after review. */
export const AiAvailabilityResponse = z.object({
  kind: z.enum(['less_time', 'lighter_day', 'urgent', 'unclear']),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  availableMinutes: z.number().int().min(0).max(720).nullable(),
  days: z.number().int().min(1).max(7).nullable(),
  explanation: z.string().max(300),
});
export type AiAvailabilityResponse = z.infer<typeof AiAvailabilityResponse>;
