import { Download, Info, ShieldCheck } from 'lucide-react';
import release from '@/lib/release.json';
import ui from './ui.module.css';
import styles from './download.module.css';

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;

/** Release facts, written by scripts/publish-apk.mjs from the APK itself. */
export const apk = {
  ...release,
  size: mb(release.bytes),
  label: `Version ${release.version} · ${mb(release.bytes)} · Android ${release.minAndroid} or newer`,
};

/** The download button on its own: a direct link to the APK file. */
export function ApkButton({ size = 'lg', variant = 'primary' }: { size?: 'md' | 'lg'; variant?: 'primary' | 'energy' | 'secondary' }) {
  if (!apk.available) return null;
  return (
    <a href={apk.file} download className={`${ui.btn} ${ui[variant]} ${size === 'lg' ? ui.lg : ''}`} data-testid="apk-download">
      <Download size={20} aria-hidden /> Download Android APK
    </a>
  );
}

/** Download card: button, version, size, install steps and checksum. Honest fallback until a build is published. */
export function ApkDownload({ id = 'download', heading = 'Get the Android app' }: { id?: string; heading?: string }) {
  if (!apk.available) {
    return (
      <p className={styles.note} role="note" id={id}>
        <Info aria-hidden size={20} />
        <span>
          <strong>The Android app isn’t published yet.</strong> A download link will appear here when a tested build is ready.
        </span>
      </p>
    );
  }
  return (
    <section className={styles.card} id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        {heading}
      </h2>
      <div className={styles.action}>
        <ApkButton />
        <p className={styles.meta}>{apk.label}</p>
      </div>
      <ol className={styles.steps}>
        <li>
          Open this page on your <strong>Android phone</strong> and tap <strong>Download Android APK</strong>.
        </li>
        <li>Open the downloaded file. If Android asks, allow your browser or file manager to install apps.</li>
        <li>
          If Play Protect warns about an unknown app, tap <strong>Install anyway</strong>. NextStep isn’t on Google Play yet.
        </li>
        <li>Open NextStep and create an account, or continue as a guest on this phone.</li>
      </ol>
      <p className={styles.small}>
        Already installed? The new version installs over the old one and keeps your data. No iPhone version yet.
      </p>
      <details className={styles.checksum}>
        <summary>
          <ShieldCheck aria-hidden size={16} /> Check the file (SHA-256)
        </summary>
        <code>{apk.sha256}</code>
      </details>
    </section>
  );
}
