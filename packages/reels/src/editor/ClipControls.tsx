'use client';

// The clip template's settings column part: the frame and the accent. Cuts
// and overlays are on the timeline under the preview (Timeline.tsx); the
// clip itself, music and the end card use the kind's ordinary slots and
// sections.

import * as React from 'react';
import { overlayItems } from '../templates/clip';
import type { ReelEdit, ReelFormat } from '../types';

export function ClipControls({ edit, change }: { edit: ReelEdit; change(e: ReelEdit): void }) {
  const count = overlayItems(edit.overlays).length;
  return (
    <>
      <h2>Frame</h2>
      <section className="vs-slot">
        <div className="vs-row">
          {(
            [
              ['landscape', '16:9'],
              ['portrait', '9:16'],
              ['square', '1:1'],
            ] as Array<[ReelFormat, string]>
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className="studio-btn"
              aria-pressed={(edit.format ?? 'landscape') === f}
              onClick={() => change({ ...edit, format: f })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="vs-check">
          <input type="checkbox" checked={edit.fit === 'contain'} onChange={(e) => change({ ...edit, fit: e.target.checked ? 'contain' : 'cover' })} />
          Show the whole picture (bars at the sides) instead of filling the frame
        </label>
      </section>

      <label className="vs-check">
        <input type="checkbox" checked={edit.levelAudio !== false} onChange={(e) => change({ ...edit, levelAudio: e.target.checked })} />
        Even out the sound (−16 LUFS, the level social platforms expect)
      </label>

      <h2>Overlays</h2>
      <section className="vs-slot">
        <p className="vs-faint">
          {count ? `${count} on the timeline. ` : ''}Add and place them on the timeline under the preview: title cards, lower thirds,
          captions, quotes, corner labels, pictures, a ticker, and fire and lightning FX.
        </p>
        <label className="vs-field">
          Accent colour
          <input
            type="color"
            value={edit.overlays?.accent ?? '#8a6d1f'}
            onChange={(e) => change({ ...edit, overlays: { ...(edit.overlays ?? {}), accent: e.target.value } })}
          />
        </label>
      </section>
    </>
  );
}
