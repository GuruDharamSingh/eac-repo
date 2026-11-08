'use client';

// The Site Builder pop-up (1d/1e): find a page, every page in site order, template rows expand to their
// copy slots, and the footer (+ New page, Theme, Profile).

import * as React from 'react';
import type { HubCardProps } from '../contract';
import { Btn, BtnLink, Icon, Popup as PopupShell, Thumb } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import { useSiteLive } from './live';
import type { SiteBuilderFaceData, SitePage } from './model';
import { SlotEditor, SlotSaveBar } from './SlotEditor';
import {
  KindTag, SwatchRow, clearIntent, editHref, editedBy, go, hairline, kindLine, leaveIntent, lowerFirst, pathText, peekIntent,
  when,
} from './parts';

export function Popup({ data, host, nav }: HubCardProps<SiteBuilderFaceData, SiteBuilderHost>) {
  const live = useSiteLive(data, host);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(() => peekIntent()?.expand ?? null);
  React.useEffect(() => clearIntent(), []);

  const uid = React.useId();
  const pages = live.pages;
  const query = q.trim().toLowerCase();
  const list = query
    ? pages.filter((p) => p.title.toLowerCase().includes(query) || pathText(p).toLowerCase().includes(query))
    : pages;
  const label = query ? `${list.length} ${list.length === 1 ? 'match' : 'matches'}` : `All ${pages.length} pages`;

  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));
  const line = kindLine(data.identity);

  return (
    <>
      <PopupShell
        icon="panels-top-left"
        title="Site builder"
        width={640}
        onClose={() => nav.close()}
        onOpenPage={() => nav.openDetail('pages')}
        footer={
          <>
            {data.can.createPages ? (
              <Btn
                variant="secondary"
                icon="plus"
                iconSize={15}
                onClick={() => {
                  leaveIntent({ newPage: true });
                  nav.openDetail('pages');
                }}
              >
                New page
              </Btn>
            ) : null}
            <Btn variant="ghost" onClick={() => nav.openDetail('theme')} style={{ gap: 8, paddingInline: 8 }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', gap: 0 }}>
                {[data.theme.colors.paper, data.theme.colors.ink, data.theme.colors.accent].map((c, i) => (
                  <span key={i} style={{ width: 12, height: 16, background: c, border: '1px solid var(--hc-divider)', marginLeft: i ? -1 : 0 }} />
                ))}
              </span>
              Theme
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => nav.openDetail('profile')}
              title={line ? `Profile: ${line}` : 'Profile'}
              style={{ marginLeft: 'auto', minWidth: 0, fontSize: 13, justifyContent: 'flex-end' }}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {line ? `Profile: ${line}` : 'Profile'}
              </span>
            </Btn>
          </>
        }
      >
        <div style={{ padding: '0 20px 12px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 31, top: 10, display: 'flex', color: 'var(--hc-n-600)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="hc-input"
            type="search"
            aria-label="Find a page"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a page by name or address"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="hc-overline" style={{ padding: '0 20px 6px', fontSize: 11 }}>{label}</div>

        <div style={{ maxHeight: 520, overflowY: 'auto', borderTop: '1px solid var(--hc-divider)' }}>
          {list.map((p) => (
            <PopRow
              key={p.id}
              page={p}
              host={host}
              live={live}
              open={open === p.id}
              onToggle={() => toggle(p.id)}
              idPrefix={`${uid}-${p.id || 'home'}`}
              canEdit={data.can.editPages}
            />
          ))}
          {list.length === 0 ? (
            <div style={{ padding: '16px 20px', fontSize: 14, color: 'var(--hc-n-700)' }}>No page matches “{q.trim()}”.</div>
          ) : null}
        </div>
      </PopupShell>
      {live.toast}
    </>
  );
}

function PopRow({ page: p, host, live, open, onToggle, idPrefix, canEdit }: {
  page: SitePage;
  host: SiteBuilderHost;
  live: ReturnType<typeof useSiteLive>;
  open: boolean;
  onToggle(): void;
  idPrefix: string;
  canEdit: boolean;
}) {
  const isTemplate = p.kind === 'template';
  const href = editHref(host, p.path);
  const view = host.liveHref(p.path);
  const dirty = live.dirty(p);
  return (
    <div className="hc-row" data-open={open} style={{ borderBottom: hairline }}>
      <div
        className="hc-row-head"
        role={isTemplate ? 'button' : undefined}
        tabIndex={isTemplate ? 0 : undefined}
        aria-expanded={isTemplate ? open : undefined}
        onClick={isTemplate ? onToggle : undefined}
        onKeyDown={
          isTemplate
            ? (e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle();
                }
              }
            : undefined
        }
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px 8px 20px', cursor: isTemplate ? 'pointer' : 'default' }}
      >
        <Thumb url={p.thumbnailUrl} title={p.title} width={80} height={50} />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
          <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--hc-n-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pathText(p)} · {lowerFirst(when(p.updatedAt))}
          </div>
        </div>
        <KindTag kind={p.kind} />
        {isTemplate ? (
          <Btn
            variant="secondary"
            style={{ width: 100 }}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {open ? 'Close' : 'Edit copy'}
          </Btn>
        ) : href ? (
          <Btn
            variant="secondary"
            style={{ width: 100 }}
            onClick={(e) => {
              e.stopPropagation();
              go(host, href);
            }}
          >
            Edit page
          </Btn>
        ) : (
          <span style={{ width: 100 }} />
        )}
        <BtnLink
          href={view}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`View ${p.title} on the site`}
          style={{ paddingInline: 6 }}
        >
          View ↗
        </BtnLink>
      </div>
      {isTemplate && open ? (
        <div className="hc-row-panel" style={{ padding: '12px 20px 16px 112px' }}>
          <SlotEditor
            slots={p.copySlots.map((s) => ({ ...s }))}
            values={live.values(p)}
            onChange={(k, v) => live.setSlot(p, k, v)}
            host={host}
            disabled={!canEdit}
            headingSize={17}
            idPrefix={idPrefix}
          />
          {canEdit ? (
            <SlotSaveBar
              dirty={dirty}
              saving={live.saving === p.id}
              savedText={`Saved · ${editedBy(p).replace(/^Edited /, 'edited ')}`}
              onSave={() => void live.save(p)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
