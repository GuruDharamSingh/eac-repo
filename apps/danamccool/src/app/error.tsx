'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dana McCool site error:', error);
  }, [error]);

  return (
    <div className="content-page content-page--centered" style={{ paddingTop: '4rem' }}>
      <h1 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
      <p>{error.message || 'An unexpected error occurred.'}</p>
      {error.digest && <p style={{ fontSize: '0.75rem' }}>Error ID: {error.digest}</p>}
      <button type="button" onClick={reset} className="button-secondary" style={{ marginTop: '1rem' }}>
        Try again
      </button>
    </div>
  );
}
