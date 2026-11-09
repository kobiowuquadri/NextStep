import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ACHIEVEMENTS } from '@nextstep/gamification';
import { LEARNING_RESOURCES, resourceSize } from '@nextstep/demo-data';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

/**
 * Upserts the reference catalogue every deployment needs: achievement
 * definitions (XP verification and unlocks reference them) and the original
 * sample learning resources. Idempotent and safe to run on every start, so a
 * fresh production database works without a separate seeding step.
 */
export async function upsertReferenceData(db: PrismaClient): Promise<{ achievements: number; resources: number }> {
  for (const a of ACHIEVEMENTS) {
    const data = { title: a.title, description: a.description, rule: a.rule, badge: a.badge };
    await db.achievement.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }
  for (const r of LEARNING_RESOURCES) {
    const data = {
      slug: r.slug,
      title: r.title,
      subject: r.subject,
      kind: r.kind,
      summary: r.summary,
      estMinutes: r.estMinutes,
      version: r.version,
      provenance: r.provenance,
      reviewStatus: r.reviewStatus,
      license: r.license,
      content: { sections: r.sections, questions: r.questions },
      sizeBytes: resourceSize(r),
    };
    await db.learningResource.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
  }
  return { achievements: ACHIEVEMENTS.length, resources: LEARNING_RESOURCES.length };
}

@Injectable()
export class ReferenceDataService implements OnApplicationBootstrap {
  private readonly log = new Logger('ReferenceData');

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const n = await upsertReferenceData(this.db);
      this.log.log(`Reference data ready (${n.achievements} achievements, ${n.resources} resources)`);
    } catch (e) {
      // Another instance may be upserting at the same moment; the data is identical, so this is not fatal.
      this.log.warn(`Reference data upsert skipped: ${(e as Error).name}`);
    }
  }
}
