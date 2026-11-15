'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';
import { Input } from './Input';
import { mediaUrl, type Focal, type MediaSlot, type MediaSource } from './MediaField';

// ============================================================================
// PicturesField: several pictures in order (design §5 "Pictures", 1f, 1p).
//
//   ┌──────────┐ ┌────┐┌────┐
//   │ On cards │ │ 2  ││ 3  │     the first is the card picture (4:5, ≤300px),
//   │    1     │ └────┘└────┘     the next three beside it in a 2×2 with a
//   │          │ ┌────┐┌ ─ ─┐     dashed "+ Add" tile; more wrap on below
//   └──────────┘ │ 4  ││ +  │
//                └────┘└ ─ ─┘
//   Picture 2 of 4 ·  [alt text …]  Focal point · Move earlier · Move later · Remove
//   Upload · Library · Camera
//
// Value: Array<{ url; alt?; focal? }> (PLAN §12 `pictures`); plain URL strings
// are read too. Order is the meaning: the first is the one on cards.
//
// Reorder by dragging a tile onto another, or by keyboard with Move earlier /
// Move later on the chosen picture; each move is announced. Alt text and the
// focal point belong to the chosen picture. Adding goes through the host's
// picker (FormHost.slots.media), opened under the tiles by the Add tile or a
// source button, as MediaField does; without one, the field says so.
// ============================================================================

export interface PictureValue {
  url: string;
  alt?: string;
  /** Where to keep in view when cropped: {x, y} in percent, or a y percent (cms-ui `focal`). */
  focal?: Focal | number;
}

/** The pictures in an answer: objects with a url (or src), or URL strings; empty ones dropped. */
export function readPictures(value: unknown): PictureValue[] {
  if (!Array.isArray(value)) return [];
  const out: PictureValue[] = [];
  for (const v of value) {
    const url = mediaUrl(v);
    if (!url) continue;
    const o = v && typeof v === 'object' ? (v as { alt?: unknown; focal?: unknown }) : {};
    const p: PictureValue = { url };
    if (typeof o.alt === 'string') p.alt = o.alt;
    if (typeof o.focal === 'number') p.focal = o.focal;
    else if (o.focal && typeof o.focal === 'object') {
      const f = o.focal as Partial<Focal>;
      if (typeof f.x === 'number' && typeof f.y === 'number') p.focal = { x: f.x, y: f.y };
    }
    out.push(p);
  }
  return out;
}

function focalOf(p: PictureValue | undefined): Focal {
  const f = p?.focal;
  if (typeof f === 'number') return { x: 50, y: f };
  if (f && typeof f === 'object') return { x: f.x, y: f.y };
  return { x: 50, y: 50 };
}

/** A picked value from the host's picker, as a picture (a URL string, or an object with url/src and maybe alt). */
function pictureFrom(v: unknown): PictureValue | null {
  const url = mediaUrl(v);
  if (!url) return null;
  const alt = v && typeof v === 'object' ? (v as { alt?: unknown }).alt : undefined;
  return typeof alt === 'string' && alt ? { url, alt } : { url };
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  if (it === undefined) return list;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it);
  return next;
}

const SOURCES: Array<{ id: MediaSource; label: string; icon: 'upload' | 'library' | 'camera' }> = [
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
];

export interface PicturesFieldProps {
  id: string;
  value: unknown;
  onChange: (pictures: PictureValue[]) => void;
  /** The host's picker (FormHost.slots.media). */
  slot?: MediaSlot | null;
  /** The field's name, for spoken labels ("Pictures"). */
  label?: string;
  accept?: string;
  /** The first picture's proportion (CSS aspect-ratio). Default "4 / 5". */
  aspect?: string;
  /** The tag on the first picture. Default "On cards". */
  firstTag?: string;
  /** No Add tile and no sources past this many. */
  max?: number;
  /** Offer "Focal point" (default true). Off where the store keeps none (commerce's artwork media: url, alt, role). */
  focal?: boolean;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
}

export function PicturesField({
  id,
  value,
  onChange,
  slot,
  label = 'Pictures',
  accept,
  aspect = '4 / 5',
  firstTag = 'On cards',
  max,
  focal = true,
  describedBy,
  tone,
  disabled,
}: PicturesFieldProps) {
  const pics = readPictures(value);
  const n = pics.length;
  const [chosen, setChosen] = React.useState(0);
  const [source, setSource] = React.useState<MediaSource | null>(null);
  const [focusing, setFocusing] = React.useState(false);
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  const [said, setSaid] = React.useState('');
  const tiles = React.useRef<Array<HTMLDivElement | null>>([]);
  const pendingFocus = React.useRef<number | null>(null);

  const sel = Math.min(chosen, Math.max(0, n - 1));
  const cur = pics[sel];
  const full = max !== undefined && n >= max;
  const pickerId = `${id}-picker`;
  const ofN = (i: number) => `Picture ${i + 1} of ${n}`;

  // After a move, keep focus on the moved picture's tile (its button is a new element at a new place).
  React.useEffect(() => {
    const i = pendingFocus.current;
    if (i === null) return;
    pendingFocus.current = null;
    tiles.current[i]?.focus();
  });

  const commit = (next: PictureValue[]) => onChange(next);

  const move = (from: number, to: number, keepFocus: boolean) => {
    if (from === to || to < 0 || to >= n) return;
    commit(moved(pics, from, to));
    setChosen(to);
    setSaid(`Moved to ${to + 1} of ${n}.${to === 0 ? ` ${firstTag}.` : ''}`);
    if (keepFocus) pendingFocus.current = to;
  };

  const remove = (i: number) => {
    commit(pics.filter((_, j) => j !== i));
    setFocusing(false);
    setChosen(Math.max(0, Math.min(i, n - 2)));
    setSaid(`Picture removed. ${n - 1} left.`);
    pendingFocus.current = n > 1 ? Math.max(0, Math.min(i, n - 2)) : null;
  };

  const choose = (i: number) => {
    if (disabled === true) return;
    if (i !== sel) setFocusing(false);
    setChosen(i);
  };

  const patchCur = (p: Partial<PictureValue>) => {
    if (!cur) return;
    commit(pics.map((x, j) => (j === sel ? { ...x, ...p } : x)));
  };

  const setFocal = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(100, Math.round(x)));
    const cy = Math.max(0, Math.min(100, Math.round(y)));
    patchCur({ focal: typeof cur?.focal === 'number' ? cy : { x: cx, y: cy } });
  };

  const add = (v: unknown) => {
    const p = pictureFrom(v);
    if (!p) return;
    commit([...pics, p]);
    setChosen(n);
    setSource(null);
    setSaid(`Picture added, ${n + 1} of ${n + 1}.`);
  };

  const tile = (p: PictureValue, i: number) => {
    const f = focalOf(p);
    const isSel = i === sel;
    const editingFocal = focal === true && isSel && focusing;
    return (
      <div
        key={`${i}:${p.url}`}
        className="frm-pics-tile frm-dots"
        data-primary={i === 0 ? '' : undefined}
        data-chosen={isSel ? '' : undefined}
        data-dragging={dragFrom === i ? '' : undefined}
        data-over={dragOver === i && dragFrom !== null && dragFrom !== i ? '' : undefined}
        style={i === 0 ? { aspectRatio: aspect } : undefined}
        draggable={!disabled && !editingFocal}
        onDragStart={(e) => {
          setDragFrom(i);
          e.dataTransfer.effectAllowed = 'move';
          try {
            e.dataTransfer.setData('text/plain', String(i));
          } catch {
            /* some browsers refuse data on a non-link drag; the index is in state */
          }
        }}
        onDragOver={(e) => {
          if (dragFrom === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOver !== i) setDragOver(i);
        }}
        onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          if (dragFrom !== null) move(dragFrom, i, false);
          setDragFrom(null);
          setDragOver(null);
        }}
        onDragEnd={() => {
          setDragFrom(null);
          setDragOver(null);
        }}
      >
        <img src={p.url} alt="" draggable={false} style={{ objectPosition: `${f.x}% ${f.y}%` }} />
        {/* A div button: Firefox will not start a drag on a <button>, and the tile is dragged by this. */}
        <div
          ref={(el) => {
            tiles.current[i] = el;
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
          className="frm-pics-hit"
          aria-pressed={isSel}
          aria-disabled={disabled ? true : undefined}
          aria-label={`${ofN(i)}${i === 0 ? `, ${firstTag.toLowerCase()}` : ''}: ${p.alt ? p.alt : 'no alt text yet'}`}
          aria-controls={`${id}-chosen`}
          onClick={() => choose(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(i);
            }
          }}
        />
        {i === 0 && <span className="frm-tag frm-tag--accent frm-pics-tag">{firstTag}</span>}
        {editingFocal && (
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
                } else if (e.key === 'Escape') {
                  setFocusing(false);
                }
              }}
            />
            <span className="frm-media-pin" style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true" />
          </>
        )}
      </div>
    );
  };

  const addTile = (first: boolean) => (
    <button
      type="button"
      className="frm-pics-add"
      data-first={first ? '' : undefined}
      data-state={tone ?? undefined}
      style={first ? { aspectRatio: aspect } : undefined}
      aria-expanded={source !== null}
      aria-controls={pickerId}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => setSource((s) => (s ? null : 'upload'))}
    >
      <Icon name={first ? 'image' : 'plus'} size={first ? 24 : 18} />
      <span>{first ? `Add pictures. The first is the one ${firstTag.toLowerCase()}.` : 'Add'}</span>
    </button>
  );

  return (
    <div className="frm-pics" data-state={tone ?? undefined}>
      <div className="frm-pics-board" role="group" aria-label={`${label}, in order. The first is the one ${firstTag.toLowerCase()}.`} id={id}>
        {n === 0 ? (
          <div className="frm-pics-primary">{addTile(true)}</div>
        ) : (
          <>
            <div className="frm-pics-primary">{tile(pics[0]!, 0)}</div>
            <div className="frm-pics-thumbs">
              {pics.slice(1).map((p, k) => tile(p, k + 1))}
              {!full && addTile(false)}
            </div>
          </>
        )}
      </div>

      {cur && (
        <div className="frm-pics-chosen" id={`${id}-chosen`} role="group" aria-label={ofN(sel)}>
          <span className="frm-pics-chosen-h">
            {ofN(sel)}
            {sel === 0 ? ` · ${firstTag}` : ''}
          </span>
          <Input
            id={`${id}-alt`}
            value={cur.alt ?? ''}
            placeholder="Describe the picture"
            aria-label={`Alt text, picture ${sel + 1}`}
            aria-describedby={`${id}-alt-hint`}
            disabled={disabled}
            onChange={(e) => patchCur({ alt: e.target.value })}
          />
          <p className="frm-hint" id={`${id}-alt-hint`}>
            Alt text, read aloud to people who can't see the picture.
          </p>
          <div className="frm-media-src">
            {focal === true && (
              <button type="button" className="frm-btn frm-btn--ghost" aria-pressed={focusing} disabled={disabled} onClick={() => setFocusing((v) => !v)}>
                <Icon name="focal" size={15} />
                Focal point
              </button>
            )}
            {/* At either end the button disables itself, so focus goes to the moved picture instead. */}
            <button type="button" className="frm-btn frm-btn--ghost" disabled={disabled || sel === 0} onClick={() => move(sel, sel - 1, sel - 1 === 0)}>
              <Icon name="caret" size={15} className="frm-turn-earlier" />
              Move earlier
            </button>
            <button type="button" className="frm-btn frm-btn--ghost" disabled={disabled || sel >= n - 1} onClick={() => move(sel, sel + 1, sel + 1 === n - 1)}>
              <Icon name="caret" size={15} className="frm-turn-later" />
              Move later
            </button>
            <button type="button" className="frm-btn frm-btn--ghost" disabled={disabled} onClick={() => remove(sel)}>
              <Icon name="close" size={15} />
              Remove
            </button>
          </div>
        </div>
      )}

      {!full && (
        <div className="frm-media-src" role="group" aria-label={`${label}: where from`}>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="frm-btn frm-btn--ghost"
              aria-expanded={source === s.id}
              aria-controls={pickerId}
              disabled={disabled}
              onClick={() => setSource((c) => (c === s.id ? null : s.id))}
            >
              <Icon name={s.icon} size={15} />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {source && (
        <div className="frm-media-picker" id={pickerId}>
          {slot ? (
            slot({ value: null, onChange: add, label, hint: 'Added after the last picture. Drag to reorder.', accept, source })
          ) : (
            <p className="frm-hint">Pictures can't be added from here yet: this site hasn't connected its picture library to the form.</p>
          )}
        </div>
      )}

      <p className="frm-sr" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
