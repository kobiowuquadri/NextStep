import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/ui';
import { ResetCode } from './ResetCode';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Use your reset code in the NextStep app.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <>
      <PageHero eyebrow="Account" title="Reset your password." intro="Your reset code works for 30 minutes. It stays in your browser — this page doesn’t send it anywhere." />
      <Section>
        <ResetCode />
      </Section>
    </>
  );
}
