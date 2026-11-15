'use client';

// The essay Canvas behind React.lazy: a host that offers the blocks editor imports this, and tiptap
// is fetched when the editor first renders, not with the page (docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md §1).
import * as React from 'react';
import type { CanvasProps } from './Canvas';

const CanvasImpl = React.lazy(() => import('./Canvas').then((m) => ({ default: m.Canvas })));

export function LazyCanvas({ fallback, ...props }: CanvasProps & { fallback?: React.ReactNode }) {
  return (
    <React.Suspense fallback={fallback ?? <div role="status">Loading the editor…</div>}>
      <CanvasImpl {...props} />
    </React.Suspense>
  );
}

export type { CanvasProps, CanvasUpload } from './Canvas';
export type { ThreadCardOptions, ThreadCardSearchHit } from './schema';
