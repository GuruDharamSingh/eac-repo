'use client';

// Detail page, Pages tab (1f-1j, 1p): toolbar, legend, grid (more than 4 pages) or list, and the expanded row
// with notes, page settings or copy slots, the save-as-template panel and the footer.

import * as React from 'react';
import { Btn, BtnLink, Chevron, Frame, Icon, Segmented, Tag, Thumb } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteLive } from './live';
import { COLOUR_ROLE, KIND_LEGEND, type PageKind, type SiteBuilderDetailData, type SitePage } from './model';
import { SlotEditor } from './SlotEditor';
import {
  KindTag, Overline, SwatchRow, colorsFor, editHref, editedBy, exceptionRoles, go, hairline, kindCounts, lowerFirst, parentOf,
  pathText, plural, when,
} from './parts';

export type Layout = 'grid' | 'list';
type Filter = 'all' | PageKind;

export interface PagesTabProps {
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
  layout: Layout;
  setLayout(l: Layout): void;
  expanded: string | null;
  setExpanded(id: string | null): void;
  /** "Add an exception" / "See in Theme": open the Theme tab with this page picked. */
  onTheme(pageId: string): void;
}

export function PagesTab({ data, host, live, layout, setLayout, expanded, setExpanded, onTheme }: PagesTabProps) {
  const [q, setQ] = React.useState('');
  const [kind, setKind] = React.useState<Filter>('all');
  const [tpl, setTpl] = React.useState<{ id: string; name: string } | null>(null);
  const pages = live.pages;
  const counts = kindCounts(pages);
  const query = q.trim().toLowerCase();
  const shown = pages.filter(
    (p) =>
      (kind === 'all' || p.kind === kind) &&
      (!query || p.title.toLowerCase().includes(query) || pathText(p).toLowerCase().includes(query)),
  );
  const canNotes = data.can.notes;

  const toolbarInput = React.useId();
  const editFor = (p: SitePage) => (p.kind === 'editor' ? editHref(host, p.path) : null);

  // Template pages open the list with their row expanded; the notes button does the same for any page.
  const showRow = (p: SitePage) => {
    setLayout('list');
    setExpanded(p.id);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 250 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, display: 'flex', color: 'var(--hc-n-600)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            id={toolbarInput}
            className="hc-input"
            type="search"
            aria-label="Find a page"
            placeholder="Find a page"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <Segmented<Filter>
          label="Filter by kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'All', count: pages.length },
            { value: 'editor', label: 'Editor', count: counts.editor },
            { value: 'template', label: 'Template', count: counts.template },
          ]}
        />
        <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>
          {shown.length === pages.length ? plural(pages.length, 'page') : `Showing ${shown.length} of ${pages.length}`}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Segmented<Layout>
            label="Layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'grid', label: 'Grid', icon: 'layout-grid' },
              { value: 'list', label: 'List', icon: 'list' },
            ]}
          />
        </span>
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 14, marginBottom: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Tag tone="editor">Editor</Tag>{KIND_LEGEND.editor}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Tag tone="template">Template</Tag>{KIND_LEGEND.template}</span>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '28px 0', fontSize: 15, color: 'var(--hc-n-700)' }}>No page matches “{q.trim()}”.</div>
      ) : layout === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(max(240px, calc((100% - 60px) / 4)), 1fr))', gap: 20 }}>
          {shown.map((p) => {
            const href = editFor(p);
            const parent = parentOf(p, pages);
            const detailsLabel = (p.notes ?? '').trim() ? (p.kind === 'editor' ? 'Notes' : 'Notes & copy') : p.kind === 'editor' ? 'Add notes' : 'Notes & copy';
            return (
              <Frame key={p.id} style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
                <Thumb url={p.thumbnailUrl} title={p.title} width="100%" height={178} large />
                <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{p.title}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--hc-n-700)' }}>{pathText(p)}</div>
                    </div>
                    <KindTag kind={p.kind} />
                  </div>
                  {parent ? <div style={{ fontSize: 13, color: 'var(--hc-n-800)' }}>Under {parent.title}</div> : null}
                  {p.sharedLayoutFor ? <div style={{ fontSize: 13, color: 'var(--hc-a-700)' }}>{p.sharedLayoutFor}</div> : null}
                  <div style={{ fontSize: 13.5, color: 'var(--hc-n-800)' }}>{editedBy(p)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                    {p.kind === 'template' ? (
                      <Btn variant="secondary" onClick={() => showRow(p)}>Edit copy</Btn>
                    ) : href ? (
                      <Btn variant="secondary" onClick={() => go(host, href)}>Open editor</Btn>
                    ) : null}
                    {canNotes ? <Btn variant="ghost" onClick={() => showRow(p)}>{detailsLabel}</Btn> : null}
                  </div>
                </div>
              </Frame>
            );
          })}
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--hc-divider)' }}>
          <ListHead canNotes={canNotes} />
          {shown.map((p) => (
            <ListRow
              key={p.id}
              page={p}
              pages={pages}
              data={data}
              host={host}
              live={live}
              open={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onTheme={onTheme}
              tpl={tpl && tpl.id === p.id ? tpl : null}
              setTpl={setTpl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const cols = (canNotes: boolean) =>
  canNotes ? '104px minmax(0,1fr) 110px 150px 44px 128px 24px' : '104px minmax(0,1fr) 110px 150px 128px 24px';

function ListHead({ canNotes }: { canNotes: boolean }) {
  const h: React.CSSProperties = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--hc-n-700)' };
  return (
    <div
      aria-hidden="true"
      style={{ display: 'grid', gridTemplateColumns: cols(canNotes), gap: 16, padding: '8px 12px', borderBottom: hairline, ...h }}
    >
      <span>Page</span>
      <span />
      <span>Kind</span>
      <span>Last edited</span>
      {canNotes ? <span>Notes</span> : null}
      <span />
      <span />
    </div>
  );
}

function ListRow({ page: p, pages, data, host, live, open, onToggle, onTheme, tpl, setTpl }: {
  page: SitePage;
  pages: SitePage[];
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
  open: boolean;
  onToggle(): void;
  onTheme(pageId: string): void;
  tpl: { id: string; name: string } | null;
  setTpl(t: { id: string; name: string } | null): void;
}) {
  const canNotes = data.can.notes;
  const href = p.kind === 'editor' ? editHref(host, p.path) : null;
  const note = (p.notes ?? '').trim();
  const nested = p.depth > 0;
  const indent = p.depth > 1 ? (p.depth - 1) * 22 : 0;
  const uid = React.useId();
  return (
    <div className="hc-row" data-open={open}>
      <div
        className="hc-row-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{ display: 'grid', gridTemplateColumns: cols(canNotes), gap: 16, alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}
      >
        <Thumb url={p.thumbnailUrl} title={p.title} width={104} height={65} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, marginLeft: indent }}>
          {nested ? (
            <span
              aria-hidden="true"
              style={{ width: 14, height: 13, flex: 'none', alignSelf: 'flex-start', marginTop: 4, borderLeft: '1px solid var(--hc-n-500)', borderBottom: '1px solid var(--hc-n-500)' }}
            />
          ) : null}
          <div style={{ minWidth: 0, lineHeight: 1.3 }}>
            <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--hc-n-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pathText(p)}
              {p.sharedLayoutFor ? <span style={{ color: 'var(--hc-a-700)' }}> · {p.sharedLayoutFor}</span> : null}
            </div>
          </div>
        </div>
        <span><KindTag kind={p.kind} /></span>
        <div style={{ lineHeight: 1.3, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>{when(p.updatedAt)}</div>
          {p.updatedBy ? <div style={{ fontSize: 14, color: 'var(--hc-n-700)' }}>{p.updatedBy}</div> : null}
        </div>
        {canNotes ? (
          <span
            title={note || 'No notes yet'}
            style={{ display: 'flex', color: note ? 'var(--hc-a-700)' : 'var(--hc-n-300)' }}
            aria-label={note ? 'Has notes' : 'No notes'}
          >
            <Icon name="sticky-note" size={18} />
          </span>
        ) : null}
        <span>
          {p.kind === 'template' ? (
            <Btn
              variant="secondary"
              style={{ width: '100%' }}
              onClick={(e) => {
                e.stopPropagation();
                if (!open) onToggle();
              }}
            >
              Edit copy
            </Btn>
          ) : href ? (
            <Btn
              variant="secondary"
              style={{ width: '100%' }}
              onClick={(e) => {
                e.stopPropagation();
                go(host, href);
              }}
            >
              Open editor
            </Btn>
          ) : null}
        </span>
        <Chevron open={open} />
      </div>
      {open ? (
        <Expanded page={p} pages={pages} data={data} host={host} live={live} onTheme={onTheme} tpl={tpl} setTpl={setTpl} idPrefix={uid} />
      ) : null}
    </div>
  );
}

function Expanded({ page: p, pages, data, host, live, onTheme, tpl, setTpl, idPrefix }: {
  page: SitePage;
  pages: SitePage[];
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
  onTheme(pageId: string): void;
  tpl: { id: string; name: string } | null;
  setTpl(t: { id: string; name: string } | null): void;
  idPrefix: string;
}) {
  const { can } = data;
  const isEditor = p.kind === 'editor';
  const m = live.meta(p);
  const dirty = live.dirty(p);
  const href = isEditor ? editHref(host, p.path) : null;
  // Titles and link text are saved through the page-meta entry, which waits on the notes store.
  const metaOn = can.editPages && can.notes;
  const saveOn = can.editPages && (!isEditor || can.notes);
  const colors = colorsFor(data.theme, p);
  const roles = exceptionRoles(p, COLOUR_ROLE);
  const tplName = tpl?.name ?? '';
  const f = (s: string) => `${idPrefix}-${s}`;

  const notes = (
    <div>
      <label htmlFor={f('notes')} className="hc-overline" style={{ display: 'block', marginBottom: 6 }}>Notes for the next editor</label>
      <textarea
        id={f('notes')}
        className="hc-input"
        rows={7}
        value={m.notes}
        disabled={!can.editPages}
        placeholder="What this page is for, what to keep, copy notes for whoever edits it next."
        onChange={(e) => live.setMeta(p, { notes: e.target.value })}
        style={{ lineHeight: 1.45 }}
      />
      <div className="hc-hint" style={{ marginTop: 6 }}>Only seen here in the hub, never on the site.</div>
    </div>
  );

  const slots = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <Overline>Copy on this page</Overline>
        <span style={{ fontSize: 12.5, color: 'var(--hc-n-700)' }}>{plural(p.copySlots.length, 'slot')}</span>
      </div>
      <SlotEditor
        slots={p.copySlots}
        values={live.values(p)}
        onChange={(k, v) => live.setSlot(p, k, v)}
        host={host}
        disabled={!can.editPages}
        idPrefix={f('slot')}
      />
    </div>
  );

  const settings = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Overline>Page settings</Overline>
      <div>
        <label htmlFor={f('title')} className="hc-label">Title</label>
        <input id={f('title')} className="hc-input" value={m.title} disabled={!metaOn} onChange={(e) => live.setMeta(p, { title: e.target.value })} />
      </div>
      <div>
        <label htmlFor={f('path')} className="hc-label">Address</label>
        <input id={f('path')} className="hc-input" value={pathText(p)} readOnly style={{ color: 'var(--hc-n-700)' }} />
      </div>
      <div>
        <label htmlFor={f('lp')} className="hc-label">Link preview text</label>
        <textarea
          id={f('lp')}
          className="hc-input"
          rows={2}
          value={m.linkPreview}
          disabled={!metaOn}
          placeholder="Shown when the page is shared. Left blank, the opening of the page is used."
          onChange={(e) => live.setMeta(p, { linkPreview: e.target.value })}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, flexWrap: 'wrap' }}>
        <SwatchRow colors={colors} size={14} />
        <span style={{ color: 'var(--hc-n-800)' }}>{roles ? `Page exception: own ${roles}` : 'Uses the site theme'}</span>
        {roles || can.editTheme ? (
          <Btn variant="ghost" style={{ fontSize: 13.5 }} onClick={() => onTheme(p.id)}>{roles ? 'See in Theme' : 'Add an exception'}</Btn>
        ) : null}
      </div>
      <div className="hc-hint" style={{ marginTop: -4 }}>Words, images and layout on this page are edited in the visual editor.</div>
    </div>
  );

  const rightCols = isEditor ? 'minmax(0,1fr) minmax(0,1.2fr)' : 'minmax(0,1fr) minmax(0,2fr)';
  return (
    <div className="hc-row-panel" style={{ padding: '18px 20px 0 132px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: can.notes ? rightCols : 'minmax(0,1fr)', gap: 28, paddingBottom: 16 }}>
        {can.notes ? notes : null}
        {isEditor ? settings : slots}
      </div>

      {tpl ? (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', marginBottom: 14,
            border: '1px solid var(--hc-a-300)', background: 'var(--hc-bg)',
          }}
        >
          <span style={{ display: 'flex', color: 'var(--hc-accent)' }}><Icon name="bookmark" size={18} /></span>
          <label htmlFor={f('tplname')} style={{ fontSize: 14 }}>Save {p.title}’s layout as a template called</label>
          <input
            id={f('tplname')}
            className="hc-input"
            value={tplName}
            autoFocus
            onChange={(e) => setTpl({ id: p.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTpl(null);
              }
            }}
            style={{ width: 220 }}
          />
          <div className="hc-hint" style={{ flexBasis: '100%', margin: 0 }}>
            Keeps the blocks, layout and words as a starting point. It appears under New page → Saved templates.
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="secondary" onClick={() => setTpl(null)}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!tplName.trim()}
              onClick={async () => {
                if (await live.saveTemplate(p, tplName.trim())) setTpl(null);
              }}
            >
              Save template
            </Btn>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--hc-divider)' }}>
        <span style={{ fontSize: 13.5, marginRight: 'auto', color: dirty ? 'var(--hc-a-800)' : 'var(--hc-n-700)' }} role="status">
          {dirty ? 'Unsaved changes' : `Saved · ${editedBy(p).replace(/^Edited /, 'edited ')}`}
        </span>
        {isEditor && can.savedTemplates && can.editPages ? (
          <Btn variant="ghost" icon="bookmark" iconSize={15} onClick={() => setTpl({ id: p.id, name: p.title })}>Save as template</Btn>
        ) : null}
        <BtnLink href={host.liveHref(p.path)} target="_blank" rel="noopener noreferrer">View page ↗</BtnLink>
        {isEditor && href ? <Btn variant="secondary" onClick={() => go(host, href)}>Open editor</Btn> : null}
        {saveOn ? (
          <Btn variant="primary" disabled={!dirty || live.saving === p.id} onClick={() => void live.save(p)}>Save</Btn>
        ) : null}
      </div>
    </div>
  );
}
