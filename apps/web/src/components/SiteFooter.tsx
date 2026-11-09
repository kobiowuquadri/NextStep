import Link from 'next/link';
import { footerNav, site } from '@/lib/site';
import { Logo } from './SiteHeader';
import { ThemeToggle } from './ThemeToggle';
import styles from './site.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Logo />
          <p>{site.tagline}</p>
          <p className={styles.footerSmall}>
            Built by {site.team}. NextStep is an independent student project and is not endorsed by any university, scholarship programme or
            hackathon organiser.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.footerLinks}>
            {footerNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href}>{n.label}</Link>
              </li>
            ))}
            {site.contactEmail && (
              <li>
                <a href={`mailto:${site.contactEmail}`}>Contact</a>
              </li>
            )}
          </ul>
        </nav>
        <div className={styles.footerMeta}>
          <ThemeToggle />
          <p className={styles.footerSmall}>© {new Date().getFullYear()} {site.team}. No ads, no trackers on this site.</p>
        </div>
      </div>
    </footer>
  );
}
