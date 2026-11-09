'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_KEY as KEY } from '@/lib/boot';
import styles from './site.module.css';

type Theme = 'system' | 'light' | 'dark';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}


export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {}
  }, []);
  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      if (t === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {}
  };
  const opts: Array<{ t: Theme; label: string; Icon: typeof Sun }> = [
    { t: 'system', label: 'System theme', Icon: Monitor },
    { t: 'light', label: 'Light theme', Icon: Sun },
    { t: 'dark', label: 'Dark theme', Icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Colour theme" className={styles.themeToggle}>
      {opts.map(({ t, label, Icon }) => (
        <button key={t} role="radio" aria-checked={theme === t} aria-label={label} title={label} onClick={() => choose(t)}>
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
