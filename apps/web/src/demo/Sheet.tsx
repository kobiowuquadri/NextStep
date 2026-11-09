'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './demo.module.css';

/** Accessible modal sheet built on <dialog>: focus is trapped, Escape closes, focus returns on close. */
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${wide ? styles.sheetWide : ''}`}
      aria-labelledby={id}
      // Only report closes the user initiated (Escape, backdrop). Programmatic closes
      // (switching to another sheet) must not clear the next sheet.
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.sheetInner}>
          <header className={styles.sheetHead}>
            <h2 id={id}>{title}</h2>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden />
            </button>
          </header>
          <div className={styles.sheetBody}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
