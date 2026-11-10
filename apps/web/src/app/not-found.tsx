import { mascotSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, PageHero } from '@/components/ui';

export default function NotFound() {
  return (
    <PageHero
      eyebrow="404"
      title="This step isn’t here."
      intro={
        <>
          The page may have moved. <br />
          <span style={{ display: 'inline-flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <ButtonLink href="/">Go home</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              Watch the demo
            </ButtonLink>
          </span>
        </>
      }
      art={<Art svg={mascotSvg({ pose: 'thinking' })} />}
    />
  );
}
