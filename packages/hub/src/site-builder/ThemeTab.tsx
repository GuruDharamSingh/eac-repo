'use client';

// Detail page, Theme tab (1k): the theme states what the site uses and lists per-page colour exceptions.
// Editing happens in the host's theme editor (host.themeEditorHref).

import * as React from 'react';
import { Btn, Frame, Thumb } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteLive } from './live';
import { COLOUR_ROLE, LOOK_NOTE, type SiteBuilderDetailData, type ThemeColors } from './model';
import { Overline, Swatch, colorsFor, fontStack, go, pathText, plural } from './parts';

// A select can't hold '' for home (that means "none"), so home travels as this.
const HOME = '__home__';
const enc = (id: string) => (id === '' ? HOME : id);
const dec = (v: string): string | null => (v === '' ? null : v === HOME ? '' : v);

const ROLE_ORDER: Array<keyof ThemeColors> = ['paper', 'surface', 'ink', 'line', 'accent', 'accent2', 'frame'];

/** Paper or ink, whichever contrasts more with the accent (README 1k). */
function onColour(paper: string, ink: string, accent: string): string {
  const lum = (h: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return 0.5;
    const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a: string, b: string) => {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  };
  return ratio(paper, accent) >= ratio(ink, accent) ? paper : ink;
}

export function ThemeTab({ data, host, live, pick, setPick }: {
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
  /** The page chosen in the add-exception row. */
  pick: string | null;
  setPick(id: string | null): void;
}) {
  const { theme, can } = data;
  const c = theme.colors;
  const look = LOOK_NOTE[theme.look];
  const pages = live.pages;
  const withException = pages.filter((p) => p.exception && Object.keys(p.exception).length > 0);
  const without = pages.filter((p) => !withException.includes(p));
  const editorHref = host.themeEditorHref?.() ?? null;
  const canEdit = can.editTheme && Boolean(host.themeEditorHref);
  const strip = pages.filter((p) => !(p.path === '' && p.id !== '')).slice(0, 3);
  const heading = fontStack(theme.headingFont);
  const body = fontStack(theme.bodyFont, 'sans-serif');
  const border =
    theme.look === 'framed' ? `2px solid ${c.frame}` : theme.look === 'gallery' ? '0' : `1px solid ${c.line}`;
  const outlineBg = theme.look === 'gallery' ? c.surface : 'transparent';
  const on = onColour(c.paper, c.ink, c.accent);
  const nav = pages.filter((p) => p.path !== '' && p.depth === 0 && p.sharedLayoutFor === null).slice(0, 3);
  const pickId = React.useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ fontSize: 24 }}>Site theme</h4>
          <p style={{ margin: '4px 0 0', fontSize: 15 }}>What every page wears, unless it’s listed under page exceptions.</p>
        </div>
        {canEdit && editorHref ? (
          <Btn variant="primary" style={{ marginLeft: 'auto' }} onClick={() => go(host, editorHref)}>Edit theme ↗</Btn>
        ) : null}
      </div>

      <Frame style={{ padding: '14px 16px 16px' }}>
        <Overline style={{ marginBottom: 10 }}>Live preview</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 14, alignItems: 'start' }}>
          <div
            aria-hidden="true"
            style={{ background: c.paper, color: c.ink, border: `1px solid ${c.line}`, fontFamily: body, overflow: 'hidden', minHeight: 150 }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: c.surface,
                borderBottom: `1px solid ${c.line}`, fontSize: 12,
              }}
            >
              <span style={{ fontFamily: heading, fontSize: 15, fontWeight: 700, marginRight: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.org.name}
              </span>
              {nav.map((p, i) => (
                <span key={p.id} style={{ color: i === nav.length - 1 ? c.accent : c.ink, whiteSpace: 'nowrap' }}>{p.title}</span>
              ))}
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 26, lineHeight: 1.1 }}>{data.identity.name || data.org.name}</div>
              <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>
                {data.identity.line}{' '}
                <span style={{ color: c.accent, textDecoration: 'underline' }}>Learn more</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <span style={{ background: c.accent, color: on, fontSize: 13, padding: '5px 12px', fontWeight: 600 }}>Join in</span>
                <span style={{ border, background: outlineBg, color: c.ink, fontSize: 13, padding: '5px 12px', fontWeight: 600 }}>Browse</span>
              </div>
            </div>
          </div>
          {strip.map((p) => (
            <Thumb key={p.id} url={p.thumbnailUrl} title={p.title} width="100%" height={150} large />
          ))}
        </div>
      </Frame>

      <div
        style={{
          display: 'grid', gridTemplateColumns: '.9fr 1fr 1fr 1.7fr', gap: 1,
          background: 'var(--hc-divider)', border: '1px solid var(--hc-divider)',
        }}
      >
        <div style={{ background: 'var(--hc-bg)', padding: '12px 14px' }}>
          <Overline>Look</Overline>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{look.name}</div>
          <div style={{ fontSize: 13.5, color: 'var(--hc-n-800)', marginTop: 2 }}>{look.note}</div>
        </div>
        <div style={{ background: 'var(--hc-bg)', padding: '12px 14px' }}>
          <Overline>Headings</Overline>
          <div style={{ fontFamily: heading, fontSize: 22, marginTop: 4 }}>{theme.headingFont}</div>
        </div>
        <div style={{ background: 'var(--hc-bg)', padding: '12px 14px' }}>
          <Overline>Body text</Overline>
          <div style={{ fontFamily: body, fontSize: 17, marginTop: 4 }}>{theme.bodyFont}</div>
        </div>
        <div style={{ background: 'var(--hc-bg)', padding: '12px 14px' }}>
          <Overline>Colours</Overline>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 6 }}>
            {ROLE_ORDER.filter((k) => k !== 'frame' || theme.look === 'framed').map((k) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                <span style={{ border: '1px solid var(--hc-divider)', display: 'flex' }}><Swatch color={c[k]} w={14} h={14} /></span>
                {COLOUR_ROLE[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h4 style={{ fontSize: 24 }}>Page exceptions</h4>
          <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>{plural(withException.length, 'page')}</span>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: 15 }}>
          Pages that change some of the site’s colours. Everything they don’t change follows the site theme.
        </p>
        {withException.length === 0 ? (
          <div style={{ padding: '14px 0', fontSize: 15, color: 'var(--hc-n-800)', borderTop: '1px solid var(--hc-divider)' }}>
            Every page follows the site theme.
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--hc-divider)' }}>
            {withException.map((p) => {
              const eff = colorsFor(theme, p);
              const href = host.themeEditorHref?.(p.id) ?? null;
              return (
                <div
                  key={p.id}
                  className="hc-row"
                  style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) minmax(0,1.5fr) auto', gap: 16, alignItems: 'center', padding: '10px 0' }}
                >
                  <Thumb url={p.thumbnailUrl} title={p.title} width={80} height={50} />
                  <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{p.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--hc-n-700)' }}>{pathText(p)}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
                    {(Object.keys(p.exception ?? {}) as Array<keyof ThemeColors>).map((k) => (
                      <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                        <span style={{ border: '1px solid var(--hc-divider)', display: 'flex' }}><Swatch color={eff[k]} w={14} h={14} /></span>
                        {COLOUR_ROLE[k]}
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: 'var(--hc-n-700)' }}>{eff[k]}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {canEdit && href ? <Btn variant="secondary" onClick={() => go(host, href)}>Edit ↗</Btn> : null}
                    {can.editTheme ? <Btn variant="ghost" onClick={() => void live.removeException(p)}>Remove</Btn> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 14, borderTop: withException.length ? undefined : '1px solid var(--hc-divider)' }}>
            <label htmlFor={pickId} style={{ fontSize: 14 }}>Add an exception for</label>
            <select
              id={pickId}
              className="hc-input"
              value={pick === null ? '' : enc(pick)}
              onChange={(e) => setPick(dec(e.target.value))}
              style={{ width: 240 }}
            >
              <option value="">Choose a page</option>
              {without.map((p) => (
                <option key={p.id} value={enc(p.id)}>{p.title}</option>
              ))}
            </select>
            <Btn
              variant="secondary"
              disabled={pick === null || !host.themeEditorHref?.(pick)}
              onClick={() => pick !== null && go(host, host.themeEditorHref?.(pick))}
            >
              Open in theme editor
            </Btn>
          </div>
        ) : null}
      </div>
    </div>
  );
}
