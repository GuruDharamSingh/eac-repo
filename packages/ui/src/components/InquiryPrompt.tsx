'use client';

/**
 * InquiryPrompt
 *
 * "What is art for?" — anonymous landing inquiry. Single textarea, no
 * signup required. POSTs to /api/inquiries on the host app. Mantine-free.
 *
 * The host app provides a route at `endpoint` (default /api/inquiries)
 * that accepts `{ prompt: string, answer: string }` and returns 200.
 */

import { useState, type ReactNode } from 'react';

export interface InquiryPromptProps {
  prompt?: string;
  /** Visible label for the textarea. Pass null to hide it visually. */
  responseLabel?: ReactNode;
  /** Endpoint to POST the answer to. Default /api/inquiries. */
  endpoint?: string;
  /** Acknowledgement shown after submission. */
  thanks?: ReactNode;
  /** Placeholder for the textarea. */
  placeholder?: string;
}

export function InquiryPrompt({
  prompt = 'What is art for?',
  responseLabel = 'Your response',
  endpoint = '/api/inquiries',
  thanks,
  placeholder = 'Take a moment. Anything you write is enough.',
}: InquiryPromptProps) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answer.trim().length < 2) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, answer: answer.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not record your response.');
      }
      setStatus('done');
    } catch (err: any) {
      setError(err.message ?? 'Network error.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <section className="eac-inquiry">
        <div className="eac-inquiry__inner">
          <h2 className="eac-title">{prompt}</h2>
          <hr className="eac-gilt-rule" />
          <p className="eac-subtitle" style={{ fontStyle: 'italic' }}>
            {thanks ?? 'Thank you. Your answer is part of the inquiry.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="eac-inquiry">
      <div className="eac-inquiry__inner">
        <h2 className="eac-title">{prompt}</h2>
        <hr className="eac-gilt-rule" />
        <form onSubmit={handleSubmit}>
          <div className="eac-form-row">
            {responseLabel && (
              <label className="eac-label" htmlFor="eac-inquiry-answer">
                {responseLabel}
              </label>
            )}
            <textarea
              id="eac-inquiry-answer"
              className="eac-textarea"
              aria-label={responseLabel ? undefined : 'Your response'}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={placeholder}
              maxLength={2000}
            />
          </div>
          {status === 'error' && error && (
            <p className="eac-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="eac-cta"
            disabled={status === 'loading' || answer.trim().length < 2}
          >
            {status === 'loading' ? 'Sending…' : 'Offer your answer'}
          </button>
        </form>
      </div>
    </section>
  );
}
