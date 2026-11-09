/**
 * Seeds reference data (achievement catalogue, original learning resources).
 * The API also upserts this on every start, so production needs no seed step.
 *
 * The fictional demo account "Tobi" is created ONLY when SEED_DEMO_ACCOUNT=true
 * and SEED_DEMO_PASSWORD is set — never by default, so a deployment never ships
 * a shared, writable account with a known password.
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildTobiScenario, DEMO_USER_ID } from '@nextstep/demo-data';
import { COLLECTION_OF } from '@nextstep/engine';
import type { SyncEntity } from '@nextstep/contracts';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { MODELS, toDb } from '../src/sync/registry.js';
import { upsertReferenceData } from '../src/reference-data.js';

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function seedReference() {
  const n = await upsertReferenceData(db);
  console.log(`Seeded ${n.achievements} achievements and ${n.resources} resources.`);
}

async function seedDemoAccount() {
  if (process.env.SEED_DEMO_ACCOUNT !== 'true') return;
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 10) throw new Error('SEED_DEMO_PASSWORD (10+ chars) is required to seed the demo account.');
  const email = process.env.SEED_DEMO_EMAIL ?? 'tobi@demo.nextstep.invalid';
  await db.user.deleteMany({ where: { OR: [{ id: DEMO_USER_ID }, { email }] } });
  const state = buildTobiScenario(Date.now());
  let rev = 0;
  await db.user.create({ data: { id: DEMO_USER_ID, email, displayName: 'Tobi (fictional)', passwordHash: await hash(password), syncRev: 0 } });
  const prefs = { ...state.preferences, id: DEMO_USER_ID };
  await db.userPreferences.create({ data: { ...(toDb('preferences', prefs) as object), id: DEMO_USER_ID, userId: DEMO_USER_ID, rev: ++rev } as never });
  const order: SyncEntity[] = ['semester', 'course', 'goal', 'task', 'subtask', 'availability', 'commitment', 'dayOverride', 'planRevision', 'session', 'focusLog', 'recoveryProposal', 'reflection', 'goalCheckin', 'resourceProgress', 'gamificationEvent', 'userAchievement'];
  for (const entity of order) {
    const rows = (state as unknown as Record<string, Array<Record<string, unknown>>>)[COLLECTION_OF[entity as Exclude<SyncEntity, 'preferences'>]] ?? [];
    for (const r of rows) {
      const delegate = (db as unknown as Record<string, any>)[MODELS[entity].delegate];
      await delegate.create({ data: { ...toDb(entity, r), id: r.id, userId: DEMO_USER_ID, rev: ++rev, fieldRevs: {} } });
    }
  }
  await db.user.update({ where: { id: DEMO_USER_ID }, data: { syncRev: rev } });
  console.log(`Seeded fictional demo account ${email} (${rev} records).`);
}

try {
  await seedReference();
  await seedDemoAccount();
} finally {
  await db.$disconnect();
}
