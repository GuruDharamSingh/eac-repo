'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createGalleryAction } from '@/lib/gallery-actions';

/** Plain-HTML form matching IFAC's galleries-section.tsx pattern, styled to
 *  the site's own look (globals.css) rather than Mantine. */
export function NewGalleryForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const t = title.trim();
    if (!t) return;
    setError(null);
    startTransition(async () => {
      const result = await createGalleryAction(t);
      if (!result.ok || !result.slug) {
        setError(result.error ?? 'Could not create the gallery.');
        return;
      }
      setTitle('');
      router.push(`/gallery/${result.slug}?edit=1`);
      router.refresh();
    });
  }

  return (
    <form className="gallery-new" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New gallery title — a series, a show, a year…"
        maxLength={160}
        aria-label="New gallery title"
        disabled={pending}
      />
      <button type="submit" className="button-secondary" disabled={pending || !title.trim()}>
        {pending ? 'Creating…' : '+ New gallery'}
      </button>
      {error && <p className="gallery-new-error">{error}</p>}
    </form>
  );
}
