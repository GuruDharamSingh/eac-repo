'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';
import { Input } from './Input';

// ============================================================================
// MediaField: a picture slot (design §3 "Cover", §4 "Cover and pictures").
//
// The picker is the HOST's (FormHost.slots.media, cms-ui ContentComposerSlots
// shape): uploads, the org library and the phone hand-off need app wiring the
// forms do not carry. This field draws the thumbnail (or the dot-screen
// placeholder), the alt text, the focal point, and the three source buttons;
// a source button opens the host's picker under the thumbnail with that
// source as a hint (`source`), which a picker that has one view ignores.
// Without a host picker the buttons say so instead of doing nothing.
// ============================================================================

export type MediaSource = 'upload' | 'library' | 'camera';

/** The host's picker, as cms-ui's ContentComposerSlots['media'] plus an optional source hint. */
export type MediaSlot = (props: {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
  hint?: string;
  accept?: string;
  source?: MediaSource;
}) => React.ReactNode;

export type Focal = { x: number; y: number };

export interface MediaFieldProps {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  slot?: MediaSlot | null;
  label?: string;
  hint?: string;
  accept?: string;
  /** "cover": thumbnail beside alt text (Post). "drop": a dashed drop area first (Gathering's pictures). */
  variant?: 'cover' | 'drop';
  /** Thumbnail proportion, CSS aspect-ratio ("16 / 9", "4 / 5"). */
  aspect?: string;
  alt?: { value: string; onChange: (v: string) => void; placeholder?: string } | null;
  /** A y percentage (cms-ui `focal`) or an {x, y} pair; the shape given is the shape returned. */
  focal?: { value: unknown; onChange: (v: number | Focal) => void } | null;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
}

export function mediaUrl(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (value && typeof value === 'object') {
    const v = value as { url?: unknown; src?: unknown };
    if (typeof v.url === 'string' && v.url) return v.url;
    if (typeof v.src === 'string' && v.src) return v.src;
  }
  return null;
}

function readFocal(v: unknown): Focal {
  if (typeof v === 'number') return { x: 50, y: v };
  if (v && typeof v === 'object') {
    const f = v as Partial<Focal>;
    return { x: typeof f.x === 'number' ? f.x : 50, y: typeof f.y === 'number' ? f.y : 50 };
  }
  return { x: 50, y: 50 };
}

const SOURCES: Array<{ id: MediaSource; label: string; icon: 'upload' | 'library' | 'camera' }> = [
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
];

export function MediaField({
  id,
  value,
  onChange,
  slot,
  label,
  hint,
  accept,
  variant = 'cover',
  aspect,
  alt,
  focal,
  describedBy,
  tone,
  disabled,
}: MediaFieldProps) {
  const url = mediaUrl(value);
  const [source, setSource] = React.useState<MediaSource | null>(null);
  const [focusing, setFocusing] = React.useState(false);
  const f = readFocal(focal?.value);
  const pickerId = `${id}-picker`;

  const setFocal = (x: number, y: number) => {
    if (!focal) return;
    const cx = Math.max(0, Math.min(100, Math.round(x)));
    const cy = Math.max(0, Math.min(100, Math.round(y)));
    focal.onChange(typeof focal.value === 'number' ? cy : { x: cx, y: cy });
  };

  const sources = (
    <div className="frm-media-src" role="group" aria-label={label ? `${label}: where from` : 'Where the picture comes from'}>
      {focal && url && (
        <button type="button" className="frm-btn frm-btn--ghost" aria-pressed={focusing} disabled={disabled} onClick={() => setFocusing((v) => !v)}>
          <Icon name="focal" size={15} />
          Focal point
        </button>
      )}
      {SOURCES.map((s) => (
        <button
          key={s.id}
          type="button"
          className="frm-btn frm-btn--ghost"
          aria-expanded={source === s.id}
          aria-controls={pickerId}
          disabled={disabled}
          onClick={() => setSource((cur) => (cur === s.id ? null : s.id))}
        >
          <Icon name={s.icon} size={15} />
          {s.label}
        </button>
      ))}
      {url && (
        <button type="button" className="frm-btn frm-btn--ghost" aria-label={label ? `Remove the ${label.toLowerCase()}` : 'Remove the picture'} disabled={disabled} onClick={() => onChange(null)}>
          <Icon name="close" size={15} />
          Remove
        </button>
      )}
    </div>
  );

  const picker = source ? (
    <div className="frm-media-picker" id={pickerId}>
      {slot ? (
        slot({
          value,
          onChange: (v) => {
            onChange(v);
            setSource(null);
          },
          label,
          hint,
          accept,
          source,
        })
      ) : (
        <p className="frm-hint">Pictures can't be added from here yet: this site hasn't connected its picture library to the form.</p>
      )}
    </div>
  ) : null;

  if (variant === 'drop' && !url) {
    return (
      <div className="frm-media" data-variant="drop" aria-describedby={describedBy}>
        <div className="frm-drop" id={id} style={{ flex: '1 1 100%' }} data-state={tone ?? undefined}>
          <Icon name="image" size={24} />
          <span>Drop pictures here. The first one is the cover.</span>
        </div>
        {sources}
        {picker}
      </div>
    );
  }

  return (
    <div className="frm-media">
      <div className="frm-media-thumb frm-dots" style={aspect ? { aspectRatio: aspect } : undefined}>
        {url && <img src={url} alt="" style={{ objectPosition: `${f.x}% ${f.y}%` }} />}
        {url && focusing && focal && (
          <>
            <button
              type="button"
              className="frm-media-focal"
              aria-label={`Focal point, ${f.x}% across, ${f.y}% down. Click the picture or use the arrow keys.`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setFocal(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 5;
                const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
                const m = moves[e.key];
                if (m) {
                  e.preventDefault();
                  setFocal(f.x + m[0], f.y + m[1]);
                }
              }}
            />
            <span className="frm-media-pin" style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true" />
          </>
        )}
      </div>
      <div className="frm-media-side">
        {alt && (
          <>
            <Input
              id={id}
              value={alt.value}
              placeholder={alt.placeholder ?? 'Describe the picture'}
              aria-label="Alt text"
              aria-describedby={[`${id}-alt-hint`, describedBy].filter(Boolean).join(' ')}
              tone={tone}
              disabled={disabled}
              onChange={(e) => alt.onChange(e.target.value)}
            />
            <p className="frm-hint" id={`${id}-alt-hint`}>
              Alt text, read aloud to people who can't see the picture.
            </p>
          </>
        )}
        {sources}
      </div>
      {picker}
    </div>
  );
}
