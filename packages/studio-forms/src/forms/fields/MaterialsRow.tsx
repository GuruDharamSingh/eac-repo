'use client';

// ============================================================================
// Materials (2026-11-14): files attached to a piece — a PDF, a song sheet, an
// order of service. Uploaded through the host (FormHost.slots.materials: each
// site's /api/upload, which files them in the org's storage and answers with
// the media row), kept in the answers as items, saved as `materialIds`
// (services' attachMaterials). Separate from the cover: one is how the page
// looks, these are what someone needs in hand.
// ============================================================================

import * as React from 'react';
import { Icon } from '../theme/context';

export interface MaterialItem {
  /** media.id: what is attached on save. */
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** The host's upload for materials. Unset: the Materials row is not drawn. */
export interface MaterialsSlot {
  upload(file: File): Promise<{ ok: true; item: MaterialItem } | { ok: false; error: string }>;
}

export function readMaterials(v: unknown): MaterialItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((m): m is MaterialItem => Boolean(m) && typeof m === 'object' && typeof (m as MaterialItem).id === 'string');
}

function size(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function materialsSummary(v: unknown): string {
  const n = readMaterials(v).length;
  return n ? `${n} ${n === 1 ? 'file' : 'files'}` : 'None yet';
}

export function MaterialsRow({
  id,
  value,
  onChange,
  slot,
  label = 'Materials',
}: {
  id: string;
  value: unknown;
  onChange: (items: MaterialItem[]) => void;
  slot: MaterialsSlot;
  label?: string;
}) {
  const items = readMaterials(value);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    let next = items;
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      const r = await slot.upload(file).catch(() => ({ ok: false as const, error: 'upload failed' }));
      // `=== false` narrows in the apps' non-strict builds too.
      if (r.ok === false) failed.push(`${file.name}: ${r.error}`);
      else next = [...next, r.item];
    }
    onChange(next);
    if (failed.length) setError(failed.join('. '));
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="frm-materials" id={id}>
      {items.length > 0 && (
        <ul className="frm-materials-list" aria-label={label}>
          {items.map((m) => (
            <li key={m.id} className="frm-materials-item">
              <a href={m.url} target="_blank" rel="noreferrer" className="frm-materials-name">
                {m.filename}
              </a>
              {m.size ? <span className="frm-materials-size">{size(m.size)}</span> : null}
              <button
                type="button"
                className="frm-btn frm-btn--ghost frm-btn--sm"
                aria-label={`Remove ${m.filename}`}
                onClick={() => onChange(items.filter((x) => x.id !== m.id))}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="frm-btn frm-btn--secondary frm-materials-add" data-busy={busy ? '' : undefined}>
        <Icon name="upload" size={15} />
        {busy ? 'Uploading…' : items.length ? 'Add more files' : 'Add files'}
        <input ref={input} type="file" multiple className="frm-sr" disabled={busy} onChange={(e) => void add(e.target.files)} />
      </label>
      {error && (
        <p className="frm-msg" data-tone="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
