# NextStep API — production image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t nextstep-api .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
# Prisma picks its engine build by the OpenSSL version it finds; the slim image has none.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# Install only what the API needs (the workspace also contains web and mobile).
RUN pnpm install --frozen-lockfile --filter "@nextstep/api..." \
 && pnpm --filter "@nextstep/api^..." run build \
 && pnpm --filter @nextstep/api run build \
 && pnpm --filter @nextstep/api deploy --prod --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# OpenSSL for Prisma's migration engine; CA certificates so it can verify TLS databases such as Neon.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 nextstep
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./prisma.config.ts
USER nextstep
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start (the API upserts its reference data on boot).
# `prisma migrate deploy` only applies migrations not yet recorded, so restarts are safe.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
