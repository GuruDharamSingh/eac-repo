'use client';

// The copy-slot form for a template page: groups, a 2-column grid, every slot type. Shared by the
// pop-up (1e) and the detail page (1i). Controlled: the owner keeps the draft (see live.tsx).

import * as React from 'react';
import { Btn, Icon } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { CopySlot } from './model';
import { SectionHead } from './parts';

const basename = (v: string) => {
  const clean = v.split('?')[0] ?? v;
  return clean.slice(clean.lastIndexOf('/') + 1) || v;
};
const looksLikeUrl = (v: string) => /^(https?:)?\/\//.test(v) || v.startsWith('/') || v.startsWith('data:');

function ImageSlot({ id, slot, value, onChange, host, disabled }: {
  id: string;
  slot: CopySlot;
  value: string;
  onChange(v: string): void;
  host: SiteBuilderHost;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const canUpload = Boolean(host.uploadImage) && !disabled;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !host.uploadImage) return;
    setBusy(true);
    setErr('');
    try {
      const res = await host.uploadImage(file, 'slot');
      if (res.ok) onChange(res.value?.url ?? '');
      else setErr('error' in res && res.error ? res.error : 'That upload didn’t go through.');
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message ? e2.message : 'That upload didn’t go through.');
    }
    setBusy(false);
  }

  const filled = value !== '';
  return (
    <div>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: 6,
          border: `1px ${filled ? 'solid' : 'dashed'} var(--hc-n-400)`,
          background: 'var(--hc-bg)',
        }}
      >
        <span
          style={{
            width: 68, height: 44, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
            background: filled ? 'var(--hc-a-100)' : 'transparent',
            border: filled ? undefined : '1px dashed var(--hc-n-300)',
            color: filled ? 'var(--hc-a-700)' : 'var(--hc-n-500)',
          }}
        >
          {filled && looksLikeUrl(value) ? (
            <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="image" size={20} />
          )}
        </span>
        <span
          style={{
            flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: filled ? 'var(--hc-text)' : 'var(--hc-n-700)',
          }}
        >
          {filled ? basename(value) : 'No image'}
        </span>
        {canUpload ? (
          <>
            <input ref={input} type="file" accept="image/*" hidden aria-label={`${slot.label}: choose an image`} onChange={pick} />
            <Btn variant="ghost" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Uploading…' : filled ? 'Replace' : 'Upload'}
            </Btn>
          </>
        ) : null}
      </div>
      {err ? <div className="hc-error" role="alert" style={{ marginTop: 4 }}>{err}</div> : null}
    </div>
  );
}

export function SlotEditor({ slots, values, onChange, host, disabled, headingSize = 18, idPrefix }: {
  slots: CopySlot[];
  values: Record<string, string>;
  onChange(key: string, value: string): void;
  host: SiteBuilderHost;
  disabled?: boolean;
  /** Group heading size: 18 on the detail page, 17 in the pop-up. */
  headingSize?: number;
  idPrefix: string;
}) {
  const multi = new Set(slots.map((s) => s.group)).size > 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 18px' }}>
      {slots.map((s, i) => {
        const area = s.type === 'textarea' || s.type === 'rich';
        const id = `${idPrefix}-${s.key.replace(/[^a-z0-9_-]/gi, '_')}`;
        const v = values[s.key] ?? s.value;
        return (
          <React.Fragment key={s.key}>
            {multi && (i === 0 || slots[i - 1].group !== s.group) ? (
              <div style={{ gridColumn: '1 / -1', marginTop: i === 0 ? 0 : 8 }}>
                <SectionHead size={headingSize}>{s.group}</SectionHead>
              </div>
            ) : null}
            <div style={{ gridColumn: area ? '1 / -1' : 'auto', minWidth: 0 }}>
              <label id={`${id}-label`} htmlFor={s.type === 'image' ? undefined : id} className="hc-label">{s.label}</label>
              {s.type === 'image' ? (
                <ImageSlot id={id} slot={s} value={v} onChange={(nv) => onChange(s.key, nv)} host={host} disabled={disabled} />
              ) : area ? (
                <textarea
                  id={id}
                  className="hc-input"
                  rows={s.rows ?? (s.type === 'rich' ? 6 : 3)}
                  value={v}
                  placeholder={s.placeholder}
                  disabled={disabled}
                  onChange={(e) => onChange(s.key, e.target.value)}
                  style={{ lineHeight: 1.45 }}
                />
              ) : (
                <input
                  id={id}
                  className="hc-input"
                  type={s.type === 'url' ? 'url' : 'text'}
                  value={v}
                  placeholder={s.placeholder}
                  disabled={disabled}
                  onChange={(e) => onChange(s.key, e.target.value)}
                />
              )}
              {s.hint ? <div className="hc-hint">{s.hint}</div> : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Save status (13.5px) and the primary Save, disabled while nothing has changed. */
export function SlotSaveBar({ dirty, savedText, saving, disabled, onSave }: {
  dirty: boolean;
  savedText: string;
  saving?: boolean;
  disabled?: boolean;
  onSave(): void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
      <span style={{ fontSize: 13.5, color: dirty ? 'var(--hc-a-800)' : 'var(--hc-n-700)' }} role="status">
        {dirty ? 'Unsaved changes' : savedText}
      </span>
      <Btn variant="primary" style={{ marginLeft: 'auto' }} disabled={!dirty || saving || disabled} onClick={onSave}>Save</Btn>
    </div>
  );
}
