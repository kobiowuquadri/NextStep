import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/ui';
import styles from '../pages.module.css';

export const metadata: Metadata = { title: 'Terms', description: 'Draft terms of use for NextStep.' };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Terms" title="Terms of use." intro="A short, plain-language draft prepared by Team Apex. It has not been reviewed by a lawyer and will be finalised before public release." />
      <Section>
        <div className="prose">
          <p className={styles.legalMeta}>Draft · last updated 8 November 2026</p>
          <h2>Using NextStep</h2>
          <p>NextStep is a planning tool. You are responsible for your own coursework, deadlines and academic decisions. Always confirm deadlines and requirements with your institution.</p>
          <h2>Plans and suggestions</h2>
          <p>
            Plans, recovery proposals, priorities and any optional AI suggestions are estimates based on the information you provide. They are not guarantees that work
            will be completed on time or that you will achieve any particular result. NextStep never changes a real deadline on your behalf.
          </p>
          <h2>Learning resources</h2>
          <p>Sample resources are written by Team Apex for demonstration, are not reviewed by an educator, and may contain mistakes. Check them against your course materials.</p>
          <h2>Your account</h2>
          <ul>
            <li>Keep your password private. You can sign out of all devices from your profile.</li>
            <li>Don’t use NextStep to store other people’s personal information or content you don’t have the right to share.</li>
            <li>You can export or delete your data at any time.</li>
          </ul>
          <h2>Rewards</h2>
          <p>XP, levels, badges and cosmetic items have no monetary value and cannot be exchanged, bought or sold.</p>
          <h2>Availability</h2>
          <p>NextStep is a student project and may change. We aim to give notice before removing features or shutting down, with time to export your data.</p>
          <h2>Liability</h2>
          <p>To the extent allowed by law, NextStep is provided “as is”. The final terms will set out governing law and liability once reviewed.</p>
        </div>
      </Section>
    </>
  );
}
