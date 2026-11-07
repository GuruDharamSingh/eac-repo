'use client';

// The Studio's picture editor, for any kind that holds pictures (2026-11-01):
// crop to a platform's shape, rotate, filters, fine-tune (brightness,
// contrast, warmth, blur), resize, text and shapes, watermark.
//
// The editing runs in the browser (Filerobot, FilerobotView.tsx), so a
// member's editing costs the server nothing. The server's part is sharp:
// `imageEndpoint` (arts-collective /api/studio/image, services
// media-convert.ts) hands the editor a working copy at most 2048 px on the
// long edge with the camera's metadata dropped, and converts pictures to
// JPEG. The host saves the result through its ordinary upload route; the
// original file is left as it was.

import * as React from 'react';
import dynamic from 'next/dynamic';

export interface ImageEditorSaved {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
}

// Client only: Konva's server entry requires the native 'canvas' package,
// which the app does not have (the build fails on it under SSR).
const FilerobotView = dynamic(() => import('./FilerobotView'), {
  ssr: false,
  loading: () => <div className="ie-busy">Opening the editor…</div>,
});

/** `/api/media/<path>` → `<path>`; null for anything else. */
export function mediaPathOf(url: string): string | null {
  const m = /^\/api\/media\/(.+?)(?:\?.*)?$/.exec(url);
  return m ? decodeURIComponent(m[1]!) : null;
}

/** A URL for a stored picture at a working size and format, via the host's sharp route; the URL itself when it is not stored media. */
export function convertedUrl(url: string, imageEndpoint: string | undefined, opts: { max?: number; format?: 'jpeg' | 'png' | 'webp' } = {}): string {
  const path = mediaPathOf(url);
  if (!path || !imageEndpoint) return url;
  const q = new URLSearchParams({ path, max: String(opts.max ?? 2048), format: opts.format ?? 'jpeg' });
  return `${imageEndpoint}?${q}`;
}

/** The edited picture as a File, ready for an upload form. */
export async function savedToFile(saved: ImageEditorSaved, name: string): Promise<File> {
  const blob = await (await fetch(saved.dataUrl)).blob();
  const ext = saved.mimeType === 'image/png' ? 'png' : saved.mimeType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${name.replace(/\.[^.]+$/, '')}-edited.${ext}`, { type: saved.mimeType });
}

export function ImageEditor({
  src,
  name,
  imageEndpoint,
  onSave,
  onClose,
}: {
  /** The picture's URL (an /api/media path opens through `imageEndpoint`). */
  src: string;
  name?: string;
  imageEndpoint?: string;
  onSave(saved: ImageEditorSaved): void | Promise<void>;
  onClose(): void;
}) {
  const [busy, setBusy] = React.useState(false);
  const fileName = name || src.split('/').pop()?.split('?')[0] || 'picture';
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [busy, onClose]);
  return (
    <div className="ie-veil" role="dialog" aria-modal="true" aria-label="Edit picture">
      <div className="ie-box">
        {busy && <div className="ie-busy">Saving…</div>}
        <FilerobotView
          src={convertedUrl(src, imageEndpoint, { max: 2048 })}
          name={fileName}
          onClose={onClose}
          onSave={async (s) => {
            setBusy(true);
            try {
              await onSave(s);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
