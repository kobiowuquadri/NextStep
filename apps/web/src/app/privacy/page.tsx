import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/ui';
import { site } from '@/lib/site';
import styles from '../pages.module.css';

export const metadata: Metadata = { title: 'Privacy', description: 'What NextStep collects, why, where it is stored and how to export or delete it.' };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Privacy" title="Your plan is yours." intro="A plain-language summary of how NextStep handles your data. This is a draft prepared by Team Apex and has not been reviewed by a lawyer." />
      <Section>
        <div className="prose">
          <p className={styles.legalMeta}>Draft · last updated 8 November 2026</p>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account:</strong> email address, display name and a securely hashed password (we never store the password itself).
            </li>
            <li>
              <strong>Planning data you enter:</strong> timezone, courses, tasks, steps, deadlines, availability, commitments, sessions, focus logs and check-ins, reflections,
              personal goals and resource progress.
            </li>
            <li>
              <strong>Progress:</strong> XP events, badges and quest progress.
            </li>
            <li>
              <strong>Technical:</strong> a random device identifier used for syncing, and basic request logs (time, route, status, duration) without your task content,
              passwords or tokens.
            </li>
          </ul>
          <p>We do not ask for your gender, ethnicity, religion, income or other sensitive personal details. Your school name is optional.</p>
          <h2>What we don’t do</h2>
          <ul>
            <li>No advertising, no advertising trackers and no selling of data.</li>
            <li>No public profiles, leaderboards or public links to your records.</li>
            <li>No sharing with your school or lecturers.</li>
          </ul>
          <h2>Where it is stored</h2>
          <p>
            On your phone, your data is stored in the app’s private storage so it works offline. Sign-in tokens are kept in the phone’s secure storage (Android Keystore
            / iOS Keychain). The local database itself is not encrypted beyond what the operating system provides, so protect your phone with a screen lock.
          </p>
          <p>On our servers, data is stored in a PostgreSQL database, sent over HTTPS, and separated per account. Every request is checked so one account cannot read another’s data.</p>
          <h2>Optional AI features</h2>
          <p>
            If AI suggestions are enabled, the text you choose to send (for example a task title and description) is sent to the AI provider configured by the operator to
            generate a suggestion. You review every suggestion before anything is saved. Planning never requires AI.
          </p>
          <h2>Your choices</h2>
          <ul>
            <li>Export all your data from Profile → Privacy → Export my data.</li>
            <li>Delete your account from Profile → Privacy → Delete account. This removes your data from our servers and clears it from the device.</li>
            <li>Logging out clears the data on that device, after warning you about anything not yet synced.</li>
          </ul>
          <h2>The demos</h2>
          <p>The interactive demo uses fictional data and stores your changes only in your own browser’s local storage. Nothing you do in it is sent to a server.</p>
          <p>The demo video and its captions are plain files served with this website. Watching them sends nothing beyond the normal request for the file.</p>
          <h2>This website</h2>
          <p>This site uses no analytics or advertising cookies. If you choose a colour theme, it is remembered in your browser’s local storage.</p>
          <h2>Contact</h2>
          <p>{site.contactEmail ? <>Questions about privacy: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</> : 'A privacy contact address will be published here before public release.'}</p>
        </div>
      </Section>
    </>
  );
}
