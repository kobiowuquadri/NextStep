import {
  AiAvailabilityRequest,
  AiAvailabilityResponse,
  AiBreakdownRequest,
  AiBreakdownResponse,
  AiCaptureRequest,
  AiCaptureResponse,
  ApiErrorBody,
  AuthResponse,
  ENTITY_SPECS,
  LoginRequest,
  LogoutRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  PullResponse,
  PushRequest,
  PushResponse,
  RecoveryInput,
  RefreshRequest,
  RegisterRequest,
  ResolveConflictRequest,
  SYNC_ENTITIES,
  z,
} from '@nextstep/contracts';
import { MODELS } from './sync/registry.js';

const js = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema: js(schema) } } });
const errors = {
  '400': { description: 'Validation failed', ...json(ApiErrorBody) },
  '401': { description: 'Missing, invalid or expired access token', ...json(ApiErrorBody) },
  '429': { description: 'Rate limited', ...json(ApiErrorBody) },
};
const secured = [{ bearer: [] }];

type Op = { summary: string; description?: string; tags: string[]; security?: unknown[]; requestBody?: unknown; parameters?: unknown[]; responses: Record<string, unknown> };

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, Op>> = {};
  const add = (path: string, method: string, op: Op) => ((paths[path] ??= {})[method] = op);

  add('/health', 'get', { summary: 'Health and database check', tags: ['System'], responses: { '200': { description: 'Healthy' }, '503': { description: 'Database unreachable' } } });

  const authOps: Array<[string, string, z.ZodType, z.ZodType | null, string]> = [
    ['register', 'Create an account', RegisterRequest, AuthResponse, '201'],
    ['login', 'Sign in', LoginRequest, AuthResponse, '200'],
    ['refresh', 'Rotate the refresh token and get a new access token', RefreshRequest, AuthResponse, '200'],
    ['password-reset/request', 'Request a password reset email (always 202)', PasswordResetRequest, null, '202'],
    ['password-reset/confirm', 'Set a new password with a reset token', PasswordResetConfirm, null, '204'],
  ];
  for (const [path, summary, req, res, code] of authOps) {
    add(`/v1/auth/${path}`, 'post', { summary, tags: ['Auth'], requestBody: { required: true, ...json(req) }, responses: { [code]: res ? { description: 'OK', ...json(res) } : { description: 'OK' }, ...errors } });
  }
  add('/v1/auth/logout', 'post', { summary: 'Revoke a refresh token (or all devices)', tags: ['Auth'], security: secured, requestBody: { required: true, ...json(LogoutRequest) }, responses: { '204': { description: 'Signed out' }, ...errors } });

  add('/v1/me', 'get', { summary: 'Current user and preferences', tags: ['Account'], security: secured, responses: { '200': { description: 'OK' }, ...errors } });
  add('/v1/me', 'delete', { summary: 'Permanently delete the account and all data', description: 'Body: { password, confirm: "DELETE" }', tags: ['Account'], security: secured, responses: { '204': { description: 'Deleted' }, ...errors } });
  add('/v1/me/export', 'get', { summary: 'Export all account data as JSON', tags: ['Account'], security: secured, responses: { '200': { description: 'Export' }, ...errors } });
  add('/v1/me/preferences', 'patch', { summary: 'Update preferences', tags: ['Account'], security: secured, requestBody: { required: true, ...json(ENTITY_SPECS.preferences.schema.partial()) }, responses: { '200': { description: 'Updated' }, ...errors } });

  add('/v1/sync/push', 'post', { summary: 'Upload queued operations (idempotent by opId)', tags: ['Sync'], security: secured, requestBody: { required: true, ...json(PushRequest) }, responses: { '200': { description: 'Per-op results', ...json(PushResponse) }, ...errors } });
  add('/v1/sync/pull', 'get', {
    summary: 'Download changes after a server-issued cursor',
    tags: ['Sync'],
    security: secured,
    parameters: [
      { name: 'cursor', in: 'query', schema: { type: 'integer', minimum: 0 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000 } },
    ],
    responses: { '200': { description: 'Changes', ...json(PullResponse) }, ...errors },
  });
  add('/v1/sync/conflicts/{id}/resolve', 'post', { summary: 'Resolve a preserved conflict', tags: ['Sync'], security: secured, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, ...json(ResolveConflictRequest) }, responses: { '200': { description: 'Resolved' }, ...errors } });

  add('/v1/today', 'get', { summary: 'Realistic actions for today', tags: ['Planning'], security: secured, responses: { '200': { description: 'Today view' }, ...errors } });
  add('/v1/planning/preview', 'post', { summary: 'Dry-run the planner (explanations, shortfall, issues)', tags: ['Planning'], security: secured, responses: { '200': { description: 'Plan' }, ...errors } });
  add('/v1/planning/generate', 'post', { summary: 'Generate and save the next plan revision', tags: ['Planning'], security: secured, responses: { '200': { description: 'Plan' }, '409': { description: 'Plan changed concurrently', ...json(ApiErrorBody) }, ...errors } });
  add('/v1/recovery/preview', 'post', { summary: 'Build a Recovery Mode proposal (nothing saved)', tags: ['Recovery'], security: secured, requestBody: { required: true, ...json(RecoveryInput) }, responses: { '200': { description: 'Proposal' }, ...errors } });
  add('/v1/recovery/accept', 'post', {
    summary: 'Accept a proposal atomically; 409 STALE_PREVIEW if the plan changed',
    tags: ['Recovery'],
    security: secured,
    requestBody: { required: true, ...json(z.object({ input: RecoveryInput, baseRevision: z.number().int(), fingerprint: z.string() })) },
    responses: { '200': { description: 'Accepted' }, '409': { description: 'Stale preview; body contains a fresh proposal', ...json(ApiErrorBody) }, ...errors },
  });
  add('/v1/recovery/keep', 'post', { summary: 'Keep the current plan (recorded for reflection)', tags: ['Recovery'], security: secured, requestBody: { required: true, ...json(RecoveryInput) }, responses: { '200': { description: 'Kept' }, ...errors } });
  add('/v1/progress', 'get', { summary: 'XP, level, quests, badges, cosmetics', tags: ['Progress'], security: secured, responses: { '200': { description: 'Progress' }, ...errors } });
  add('/v1/reflection/current', 'get', { summary: 'This week’s reflection summary', tags: ['Progress'], security: secured, responses: { '200': { description: 'Summary' }, ...errors } });
  add('/v1/resources', 'get', { summary: 'Resource catalogue with download sizes', tags: ['Resources'], responses: { '200': { description: 'Catalogue' } } });
  add('/v1/resources/{id}', 'get', { summary: 'Resource content', tags: ['Resources'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Resource' }, '404': { description: 'Not found' } } });

  const ai: Array<[string, z.ZodType, z.ZodType, string]> = [
    ['breakdown', AiBreakdownRequest, AiBreakdownResponse, 'Suggest steps for a task (review before saving)'],
    ['capture', AiCaptureRequest, AiCaptureResponse, 'Turn a note into a draft task (review before saving)'],
    ['availability', AiAvailabilityRequest, AiAvailabilityResponse, 'Interpret a changed-availability note as a recovery input'],
  ];
  for (const [p, req, res, summary] of ai) {
    add(`/v1/ai/${p}`, 'post', { summary, description: 'Optional. 503 AI_NOT_CONFIGURED when no provider key is set.', tags: ['AI (optional)'], security: secured, requestBody: { required: true, ...json(req) }, responses: { '200': { description: 'Suggestion', ...json(res) }, '503': { description: 'Not configured or unavailable', ...json(ApiErrorBody) }, ...errors } });
  }

  for (const entity of SYNC_ENTITIES) {
    if (entity === 'preferences') continue;
    const m = MODELS[entity];
    const schema = js(ENTITY_SPECS[entity].schema);
    const base = `/v1/${m.path}`;
    const tag = 'Collections';
    add(base, 'get', { summary: `List ${m.path} (paged by revision)`, tags: [tag], security: secured, parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'cursor', in: 'query', schema: { type: 'string' } }, { name: 'includeDeleted', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'Page' }, ...errors } });
    add(`${base}/{id}`, 'get', { summary: `Get one ${entity}`, tags: [tag], security: secured, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Record', content: { 'application/json': { schema } } }, '404': { description: 'Not found' }, ...errors } });
    if (m.writable) {
      add(base, 'post', { summary: `Create ${entity}`, tags: [tag], security: secured, requestBody: { required: true, content: { 'application/json': { schema } } }, responses: { '201': { description: 'Created' }, ...errors } });
      add(`${base}/{id}`, 'patch', { summary: `Update ${entity} (If-Match: rev for conflict detection)`, tags: [tag], security: secured, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'If-Match', in: 'header', schema: { type: 'string' } }], responses: { '200': { description: 'Updated' }, ...errors } });
      add(`${base}/{id}`, 'delete', { summary: `Delete ${entity} (tombstone)`, tags: [tag], security: secured, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '204': { description: 'Deleted' }, ...errors } });
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: 'NextStep API', version: '1.0.0', description: 'REST API for NextStep by Team Apex. All timestamps are ISO-8601 UTC; dates are YYYY-MM-DD in the student’s timezone.' },
    servers: [{ url: '/' }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths,
  };
}

export const DOCS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NextStep API</title></head>
<body><script id="api-reference" data-url="/docs/openapi.json"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.1/dist/browser/standalone.js"></script></body></html>`;
