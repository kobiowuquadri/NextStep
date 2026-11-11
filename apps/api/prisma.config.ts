import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // process.env, not env(): `prisma generate` needs no database, and hosts such as Render do not pass
  // runtime variables into a Docker build. Migrate commands still stop with an error when it is missing.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
