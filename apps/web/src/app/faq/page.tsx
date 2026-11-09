import type { Metadata } from 'next';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, PageHero, Section } from '@/components/ui';
import { FAQ, FaqList } from '@/components/Faq';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about NextStep: availability, offline use, deadlines, Recovery Mode, AI, gamification and privacy.',
};

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions, answered honestly." intro="If something isn’t covered here, it probably isn’t built yet — and we’d rather say so." art={<Art svg={mascotSvg({ pose: 'thinking' })} />} />
      <Section>
        <FaqList items={FAQ} columns={2} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Section>
    </>
  );
}
