'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { logoMarkSvg } from '@nextstep/illustrations';
import { nav } from '@/lib/site';
import styles from './site.module.css';

export function Logo() {
  return (
    <Link href="/" className={styles.logo} aria-label="NextStep home">
      <span className={styles.logoMark} dangerouslySetInnerHTML={{ __html: logoMarkSvg({ size: 38 }) }} />
      <span className={styles.wordmark}>NextStep</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Logo />
        <nav aria-label="Main" className={styles.desktopNav}>
          <ul>
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={pathname === n.href ? 'page' : undefined} className={styles.navLink}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.headerCta}>
          <Link href="/demo" className={styles.demoBtn}>
            Watch the demo
          </Link>
          <button className={styles.menuBtn} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
            {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
            <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>
      <nav id={menuId} aria-label="Mobile" className={styles.mobileNav} hidden={!open}>
        <ul className="container">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={pathname === n.href ? 'page' : undefined}>
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/demo">Watch the demo</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
