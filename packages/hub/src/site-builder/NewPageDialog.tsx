'use client';

// The New page dialog (1j, 1o): name, place under, address, start from (built-in starts, a copy, a saved template).
// Create → site-page-create, then the visual editor opens on the new page.

import * as React from 'react';
import { Btn, Frame, Icon, Tag, Thumb } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteLive } from './live';
import { SLUG_RE, slugFromName, type SiteBuilderDetailData } from './model';
import { editHref, go, shortDate } from './parts';

const COPY_START = { id: 'copy', name: 'Copy a page', note: 'Same layout as a page you already have.' };

const tileStyle = (on: boolean): React.CSSProperties => ({
  textAlign: 'left', padding: 8, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
  border: `1px solid ${on ? 'var(--hc-accent)' : 'var(--hc-divider)'}`,
  boxShadow: on ? 'inset 0 0 0 1px var(--hc-accent)' : 'none',
  background: on ? 'color-mix(in srgb, var(--hc-accent) 6%, transparent)' : 'transparent',
  borderRadius: 'var(--hc-radius)', minWidth: 0,
});

const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500 };

export function NewPageDialog({ data, host, live, onClose, onCreated }: {
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
  onClose(): void;
  /** After a successful create, with the new path. */
  onCreated(path: string): void;
}) {
  const pages = live.pages;
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [parentId, setParentId] = React.useState('');
  const [start, setStart] = React.useState('blank');
  const editors = pages.filter((p) => p.kind === 'editor');
  const [copyOf, setCopyOf] = React.useState(editors[0]?.id ?? '');
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState('');
  const nameRef = React.useRef<HTMLInputElement>(null);
  const uid = React.useId();

  React.useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Pages that can have children: a real slug, not a shared layout placeholder.
  const parentOpts = pages.filter((p) => p.path !== '' && !p.path.includes('…'));
  const parent = parentId ? parentOpts.find((p) => p.id === parentId) ?? null : null;
  const shownSlug = touched ? slug : slugFromName(name);
  const fullPath = parent ? `${parent.path}/${shownSlug}` : shownSlug;
  const taken = new Set(pages.map((p) => p.path));
  let err = '';
  if (shownSlug && !SLUG_RE.test(shownSlug)) err = 'Use lowercase letters, numbers and dashes.';
  else if (shownSlug && taken.has(fullPath)) err = `/${fullPath} is already a page. Pick another address.`;
  const bad = !shownSlug || Boolean(err);

  const canTemplates = data.can.savedTemplates;
  const templates = canTemplates ? data.savedTemplates : [];
  const tplSel = start.startsWith('t:') ? templates.find((t) => `t:${t.id}` === start) ?? null : null;
  const copyPage = start === 'copy' ? pages.find((p) => p.id === copyOf) ?? null : null;
  const starts = [...data.pageStarts, COPY_START];
  const titleShown = name.trim() || 'New page';

  async function create() {
    if (bad || busy) return;
    const title = name.trim() || shownSlug;
    const input: Record<string, unknown> = { title, path: fullPath, start: tplSel ? 'template' : start };
    if (copyPage) input.fromPath = copyPage.path;
    if (tplSel) input.templateId = tplSel.id;
    setBusy(true);
    setFailed('');
    const e = await live.call('site-page-create', input);
    setBusy(false);
    if (e) {
      setFailed(e);
      live.fail(e);
      return;
    }
    live.say(`Created /${fullPath}. Opening it in the visual editor`);
    onCreated(fullPath);
    go(host, editHref(host, fullPath));
  }

  return (
    <div
      className="hc-dialog-backdrop"
      style={{ placeItems: 'start center', paddingTop: 84, overflowY: 'auto' }}
      onClick={onClose}
    >
      <Frame
        elev="lg"
        className="hc-dialog"
        role="dialog"
        aria-label="New page"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ width: 'min(800px, 100%)', padding: '22px 24px 20px', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h4 style={{ fontSize: 26 }}>New page</h4>
          <Btn variant="ghost" square icon="close" iconSize={16} aria-label="Close" style={{ marginLeft: 'auto', color: 'var(--hc-text)' }} onClick={onClose} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={`${uid}-name`} style={labelStyle}>Page name</label>
            <input id={`${uid}-name`} ref={nameRef} className="hc-input" value={name} placeholder="Visiting" onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={`${uid}-parent`} style={labelStyle}>Place under</label>
            <select id={`${uid}-parent`} className="hc-input" value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ background: 'transparent' }}>
              <option value="">Top level</option>
              {parentOpts.map((p) => (
                <option key={p.id} value={p.id}>{p.title}   /{p.path}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`${uid}-slug`} style={labelStyle}>Address</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--hc-n-400)', borderRadius: 'var(--hc-radius-control)' }}>
            <span style={{ padding: '0 2px 0 12px', fontSize: 15, color: 'var(--hc-n-700)', whiteSpace: 'nowrap' }}>
              {data.org.domain}/<span style={{ color: 'var(--hc-text)' }}>{parent ? `${parent.path}/` : ''}</span>
            </span>
            <input
              id={`${uid}-slug`}
              className="hc-input"
              value={shownSlug}
              placeholder="visiting"
              aria-invalid={Boolean(err)}
              onChange={(e) => {
                setSlug(e.target.value);
                setTouched(true);
              }}
              style={{ border: 0, boxShadow: 'none', paddingLeft: 0, flex: 1, minWidth: 0, background: 'transparent' }}
            />
          </div>
          {err ? <span className="hc-error" role="alert">{err}</span> : null}
          {parent ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 14px 10px', border: '1px dashed var(--hc-n-400)', fontSize: 14, minWidth: 300 }}>
                <span>{parent.title} <span style={{ fontSize: 12.5, color: 'var(--hc-n-700)' }}>/{parent.path}</span></span>
                <span style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingLeft: 6 }}>
                  <span style={{ width: 12, height: 14, flex: 'none', borderLeft: '1px solid var(--hc-n-500)', borderBottom: '1px solid var(--hc-n-500)', marginBottom: 6 }} />
                  <span style={{ fontWeight: 600 }}>{titleShown}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--hc-n-700)' }}>/{fullPath}</span>
                  <Tag tone="accent">New</Tag>
                </span>
              </div>
              <span style={{ flex: '1 1 220px', fontSize: 13.5, color: 'var(--hc-n-800)', lineHeight: 1.45, paddingTop: 6 }}>
                Listed under {parent.title} in Pages. If {parent.title} moves, this page moves with it.
              </span>
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Start from</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {starts.map((s) => (
              <button key={s.id} type="button" aria-pressed={start === s.id} onClick={() => setStart(s.id)} style={tileStyle(start === s.id)}>
                <Thumb url={null} title={s.name} width="100%" height={84} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--hc-n-800)' }}>{s.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={labelStyle}>Saved templates</span>
            <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>Made from {data.org.name}’s own pages</span>
          </div>
          {templates.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {templates.map((t) => {
                const key = `t:${t.id}`;
                const sd = shortDate(t.createdAt);
                return (
                  <button key={t.id} type="button" aria-pressed={start === key} onClick={() => setStart(key)} style={tileStyle(start === key)}>
                    <Thumb url={null} title={t.name} width="100%" height={84} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--hc-n-800)' }}>
                      From {t.fromPage} · {t.createdBy}{sd ? `, ${sd}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px dashed var(--hc-n-400)',
                fontSize: 14, color: 'var(--hc-n-800)',
              }}
            >
              <span style={{ display: 'flex', color: 'var(--hc-n-600)' }}><Icon name="bookmark" size={16} /></span>
              None yet. Open an editor page’s row in Pages and choose Save as template.
            </div>
          )}
        </div>

        {tplSel ? (
          <div
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid var(--hc-a-300)',
              background: 'color-mix(in srgb, var(--hc-accent) 6%, transparent)',
            }}
          >
            <span style={{ display: 'flex', color: 'var(--hc-a-700)', marginTop: 2 }}><Icon name="bookmark" size={18} /></span>
            <div style={{ lineHeight: 1.45 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{tplSel.name} · {tplSel.blockCount} blocks</div>
              <div style={{ fontSize: 14 }}>{tplSel.description}</div>
              <div style={{ fontSize: 13.5, color: 'var(--hc-n-800)' }}>
                Saved from {tplSel.fromPage} by {tplSel.createdBy} on {shortDate(tplSel.createdAt)}. The new page gets its own copy, so
                changing the template later won’t touch it.
              </div>
            </div>
          </div>
        ) : null}

        {start === 'copy' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, flexWrap: 'wrap' }}>
            <label htmlFor={`${uid}-copy`}>Copy the layout of</label>
            <select id={`${uid}-copy`} className="hc-input" value={copyOf} onChange={(e) => setCopyOf(e.target.value)} style={{ width: 260, background: 'transparent' }}>
              {editors.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--hc-n-800)' }}>
          <Icon name="info" size={16} />
          Posts, articles and series are added from the Content card. A page here is part of the site’s structure.
        </div>
        {failed ? <div className="hc-error" role="alert">{failed}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={bad || busy} onClick={() => void create()}>Create and open editor</Btn>
        </div>
      </Frame>
    </div>
  );
}
