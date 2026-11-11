import { useEffect, useState } from 'react';

/** True once `busy` has lasted `ms`. Used to explain a wait while the server wakes up. */
export function useSlow(busy: boolean, ms = 5000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [busy, ms]);
  return busy && slow;
}
