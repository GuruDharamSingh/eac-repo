'use client';

import * as React from 'react';

// ============================================================================
// Starting a piece is one field: a title.
//
// The same shape as starting a gallery page, for the same reason — everything
// else about a piece (the standfirst, the cover, the writing itself) is done
// ON the piece, where you can see it. A "new post" form with six fields is a
// form you fill in before you have anything to say.
// ============================================================================

export interface StartPieceProps {
  /** Returns the new piece's slug; the desk opens at `${basePath}/${slug}?edit=1`. */
  onCreate: (title: string) => Promise<{ ok: boolean; error?: string; slug?: string }>;
  basePath: string;
  placeholder?: string;
  label?: string;
}

export function StartPiece({
  onCreate,
  basePath,
  placeholder = 'A title to start with…',
  label = 'Start a piece',
}: StartPieceProps) {
  const base = basePath.replace(/\/$/, '');
  const [title, setTitle] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onCreate(t);
      if (!result.ok || !result.slug) {
        setError(result.error ?? 'Could not start that piece.');
        setBusy(false);
        return;
      }
      // Straight to the desk — a new draft with nothing in it is not something
      // anyone wants to look at on a shelf.
      window.location.assign(`${base}/${result.slug}?edit=1`);
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <form className="eac-start" onSubmit={submit}>
      <label className="eac-desk__label eac-start__label" htmlFor="eac-start-piece">
        {label}
      </label>
      <input
        id="eac-start-piece"
        className="eac-start__input"
        type="text"
        value={title}
        maxLength={200}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        type="submit"
        className="eac-desk__btn"
        disabled={busy || !title.trim()}
      >
        {busy ? 'Starting…' : 'Start'}
      </button>
      {error && (
        <p className="eac-desk__error eac-start__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
