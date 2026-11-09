import { createHash, randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type CallHandler,
  createParamDecorator,
  type ExceptionFilter,
  type ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response, NextFunction } from 'express';
import { tap, type Observable } from 'rxjs';
import { ErrorCodes, type z } from '@nextstep/contracts';

/** Typed API error with a stable machine-readable code. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, ErrorCodes.VALIDATION_FAILED, message, details);
export const notFound = (what = 'Resource') => new ApiError(404, ErrorCodes.NOT_FOUND, `${what} not found`);
export const unauthenticated = (message = 'Sign in required', code: string = ErrorCodes.UNAUTHENTICATED) => new ApiError(401, code, message);

/** Validate with a shared Zod schema; on failure respond 400 with field-level issues. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw badRequest(
      'Some fields are missing or invalid.',
      r.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export interface AuthedRequest extends Request {
  requestId: string;
  user?: { id: string; sid: string };
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw unauthenticated();
  return req.user;
});

export function requestIdMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

/** A short, non-reversible user reference for logs. Never log emails, tokens or task content. */
export function userRef(userId?: string): string {
  return userId ? createHash('sha256').update(userId).digest('hex').slice(0, 10) : '-';
}

/** Logs method, route pattern, status, duration and request id only — no bodies, headers or query strings. */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest & { route?: { path?: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const started = Date.now();
    const done = () =>
      this.log.log(`${req.method} ${req.route?.path ?? req.path.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms req=${req.requestId} user=${userRef(req.user?.id)}`);
    return next.handle().pipe(tap({ next: done, error: () => undefined }));
  }
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AuthedRequest & { route?: { path?: string } }>();
    let status = 500;
    let code: string = ErrorCodes.INTERNAL;
    let message = 'Something went wrong on our side. Please try again.';
    let details: unknown;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = 429;
      code = ErrorCodes.RATE_LIMITED;
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 404 ? ErrorCodes.NOT_FOUND : status === 401 ? ErrorCodes.UNAUTHENTICATED : status === 403 ? ErrorCodes.FORBIDDEN : status === 413 ? 'PAYLOAD_TOO_LARGE' : ErrorCodes.VALIDATION_FAILED;
      message = status === 404 ? 'Not found' : exception.message;
    } else if (exception && typeof exception === 'object' && 'code' in exception && (exception as { code: string }).code === 'NOT_FOUND') {
      status = 404;
      code = ErrorCodes.NOT_FOUND;
      message = (exception as unknown as Error).message;
    }
    if (status >= 500 && exception instanceof ApiError) {
      this.log.warn(`${req.method} ${req.route?.path ?? req.path} ${status} ${code} req=${req.requestId}`);
    } else if (status >= 500) {
      // Log the error type and route only; never the request body.
      this.log.error(`${req.method} ${req.route?.path ?? req.path} failed req=${req.requestId}: ${(exception as Error)?.name ?? 'Error'}: ${(exception as Error)?.message?.slice(0, 300)}`);
    }
    res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}), requestId: req.requestId } });
  }
}
