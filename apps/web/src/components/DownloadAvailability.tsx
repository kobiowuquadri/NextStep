import { Info, Smartphone } from 'lucide-react';
import { hasDownloads, site } from '@/lib/site';
import styles from './download.module.css';

/**
 * Shows real download links only when they are configured
 * (NEXT_PUBLIC_ANDROID_URL / NEXT_PUBLIC_IOS_URL / NEXT_PUBLIC_APK_URL).
 * Until then, an honest availability message — never fake store badges.
 */
export function DownloadAvailability() {
  if (!hasDownloads()) {
    return (
      <p className={styles.note} role="note">
        <Info aria-hidden size={20} />
        <span>
          <strong>The mobile apps aren’t published yet.</strong> Android is the first release target, followed by iOS. Links will appear here when real
          builds are available.
        </span>
      </p>
    );
  }
  const links = [
    { href: site.downloads.android, label: 'Get it for Android' },
    { href: site.downloads.ios, label: 'Get it for iPhone' },
    { href: site.downloads.apk, label: 'Download the Android APK' },
  ].filter((l) => l.href);
  return (
    <ul className={styles.links}>
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} className={styles.link} rel="noopener">
            <Smartphone aria-hidden size={20} /> {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
