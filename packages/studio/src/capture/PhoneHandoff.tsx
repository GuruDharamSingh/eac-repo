'use client';

// The computer's half of recording with a phone: get a code, show the short
// link, and wait while the phone records and uploads (PhoneCapture on
// /c/<code>). The file lands in the person's Recordings folder; the result
// comes back here through the code's status.

import * as React from 'react';
import type { CaptureResult } from './Capture';

export interface PhoneHandoffProps {
  captureEndpoint: string;
  /** "arts-collective.com": the address the person types on the phone. */
  phoneHost?: string;
  onSaved(result: CaptureResult): void;
  onCancel(): void;
}

const STATUS: Record<string, string> = {
  waiting: 'Waiting for your phone…',
  recording: 'Your phone is recording.',
  uploading: 'Your phone is sending the video…',
  failed: 'The phone reported a problem.',
  done: 'Received.',
};

export function PhoneHandoff({ captureEndpoint, phoneHost, onSaved, onCancel }: PhoneHandoffProps) {
  const [code, setCode] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState('waiting');
  const [error, setError] = React.useState<string | null>(null);
  const host = phoneHost ?? (typeof window !== 'undefined' ? window.location.host : '');

  const make = React.useCallback(async () => {
    setError(null);
    setStatus('waiting');
    const res = await fetch(captureEndpoint, { method: 'POST' });
    const j = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    if (!res.ok || !j.code) setError(j.error ?? 'Could not make a code');
    else setCode(j.code);
  }, [captureEndpoint]);
  React.useEffect(() => {
    void make();
  }, [make]);

  React.useEffect(() => {
    if (!code) return;
    let stop = false;
    const t = window.setInterval(async () => {
      const res = await fetch(`${captureEndpoint}?code=${encodeURIComponent(code)}`).catch(() => null);
      if (!res || stop) return;
      if (res.status === 404) {
        setError('The code expired. Make a new one.');
        window.clearInterval(t);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { status?: string; result?: CaptureResult; error?: string };
      if (j.status) setStatus(j.status);
      if (j.status === 'failed' && j.error) setError(j.error);
      if (j.status === 'done' && j.result) {
        window.clearInterval(t);
        onSaved(j.result);
      }
    }, 2000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [code, captureEndpoint, onSaved]);

  const shown = code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
  return (
    <div className="cap cap-phone">
      <p className="studio-hint">On your phone, open:</p>
      <p className="cap-phone__link">
        {host}/c/<b>{shown || '…'}</b>
      </p>
      <p className="studio-hint">
        Use the phone’s camera there (front or back), record, and stop. The video comes to your Recordings by itself. The code works once,
        for 30 minutes.
      </p>
      <p className="cap-phone__status" aria-live="polite">
        {error ?? STATUS[status] ?? status}
      </p>
      <div className="cap-row">
        {error && (
          <button type="button" className="studio-btn" onClick={() => void make()}>
            New code
          </button>
        )}
        <button type="button" className="studio-btn studio-btn--text" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
