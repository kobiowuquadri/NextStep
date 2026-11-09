'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Reveals [data-reveal] elements as they scroll into view. Re-scans on every route change. */
export function MotionObserver() {
  const pathname = usePathname();
  useEffect(() => {
    (window as unknown as { __nsReveal?: boolean }).__nsReveal = true;
    const root = document.documentElement;
    if (root.getAttribute('data-motion') !== 'on') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    document.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
