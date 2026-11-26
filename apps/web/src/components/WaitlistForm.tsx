'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { site } from '@/lib/site';
import ui from './ui.module.css';
import styles from './waitlist.module.css';

type Status = 'idle' | 'sending' | 'done' | 'error';

/** Email sign-up for the waitlist. Sends only the email to the NextStep API. */
export function WaitlistForm() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [slow, setSlow] = useState(false);

  // The free API server sleeps when idle; say so if the first request takes a while.
  useEffect(() => {
    if (status !== 'sending') return;
    const t = setTimeout(() => setSlow(true), 5000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [status]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setMessage('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);
    try {
      const res = await fetch(`${site.apiUrl}/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        signal: controller.signal,
      });
      if (res.ok) {
        setStatus('done');
        setMessage('You’re on the list. We’ll email you when NextStep is ready.');
        return;
      }
      setStatus('error');
      setMessage(
        res.status === 400
          ? 'That doesn’t look like an email address. Please check it and try again.'
          : res.status === 429
            ? 'Too many tries in a row. Please wait a minute and try again.'
            : 'Something went wrong on our side. Please try again in a moment.',
      );
    } catch {
      setStatus('error');
      setMessage('We couldn’t reach NextStep. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  }

  if (status === 'done') {
    return (
      <p className={styles.done} role="status">
        <CircleCheck aria-hidden size={24} />
        <span>{message}</span>
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate={false}>
      <label htmlFor={`${id}-email`} className="visually-hidden">
        Email address
      </label>
      <input
        id={`${id}-email`}
        className={styles.input}
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={`${id}-note`}
        aria-invalid={status === 'error' || undefined}
      />
      <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.lg} ${styles.button}`} disabled={status === 'sending'}>
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
        {status !== 'sending' && <ArrowRight aria-hidden size={20} />}
      </button>
      <p id={`${id}-note`} className={status === 'error' ? styles.error : styles.note} aria-live="polite">
        {status === 'error'
          ? message
          : slow
            ? 'Waking up our server — this can take up to a minute.'
            : 'We’ll only use your email to tell you about NextStep. No spam.'}
      </p>
    </form>
  );
}
