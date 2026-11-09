'use client';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Card } from '@/components/ui';

/** Reads the code from the URL fragment (never sent to any server) so the student can paste it into the app. */
export function ResetCode() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const m = /token=([A-Za-z0-9_-]{20,200})/.exec(window.location.hash);
    setToken(m ? m[1]! : '');
  }, []);
  if (token === null) return null;
  if (!token) {
    return (
      <Card>
        <h2 style={{ fontSize: '1.4rem' }}>No reset code found</h2>
        <p>Open the link from your reset email on this device, or request a new one in the app: Sign in → Forgot password?</p>
      </Card>
    );
  }
  return (
    <Card tone="primary">
      <h2 style={{ fontSize: '1.4rem' }}>Your reset code</h2>
      <p>
        In the NextStep app, go to <strong>Sign in → Forgot password? → Reset code</strong>, paste this code and choose a new password.
      </p>
      <code style={{ display: 'block', wordBreak: 'break-all', padding: 14, borderRadius: 12, border: '2px solid var(--ns-border-strong)', background: 'var(--ns-surface)', fontSize: '1rem', margin: '12px 0' }} aria-label="Reset code">
        {token}
      </code>
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={18} aria-hidden /> {copied ? 'Copied' : 'Copy code'}
      </Button>
    </Card>
  );
}
