import { Controller, Get, Header, Inject, Param } from '@nestjs/common';
import { Id } from '@nextstep/contracts';
import { notFound, parse, Public } from '../common/http.js';
import { PrismaService } from '../prisma.service.js';

/** Small catalogue of original sample resources. Public: contains no user data. */
@Controller('v1/resources')
export class ResourcesController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Catalogue without content, including the download size shown before downloading. */
  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  async list() {
    const rows = await this.db.learningResource.findMany({ orderBy: { title: 'asc' } });
    return {
      items: rows.map(({ content: _content, publishedAt, ...r }) => ({ ...r, publishedAt: publishedAt.toISOString() })),
    };
  }

  @Public()
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=86400')
  async get(@Param('id') id: string) {
    parse(Id, id);
    const r = await this.db.learningResource.findUnique({ where: { id } });
    if (!r) throw notFound('Resource');
    const content = r.content as { sections: unknown[]; questions: unknown[] };
    return {
      id: r.id, slug: r.slug, title: r.title, subject: r.subject, kind: r.kind, summary: r.summary, estMinutes: r.estMinutes, version: r.version,
      provenance: r.provenance, reviewStatus: r.reviewStatus, license: r.license, sizeBytes: r.sizeBytes, sections: content.sections, questions: content.questions,
    };
  }
}
