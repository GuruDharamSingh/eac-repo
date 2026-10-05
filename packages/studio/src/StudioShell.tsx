'use client';

import * as React from 'react';
import { STUDIO_KINDS } from './kinds';
import { STUDIO_LAYOUTS } from './types';
import { MediaBrowser } from '@elkdonis/cms-ui/files';
import { WritingEditor, type SaveState } from './writing/WritingEditor';
import { StudioFrameContext, type StudioExtension, type StudioFrameApi } from './frame';
import type {
  StudioActions,
  StudioIdentity,
  StudioLinks,
  StudioListing,
  StudioOrg,
  StudioPatch,
  StudioPiece,
  StudioPieceSummary,
  StudioResult,
  StudioUpload,
  StudioViewer,
} from './types';

// ============================================================================
// The frame: top bar, pieces drawer, editor, settings.
//
// Three columns on a wide screen. The editor column keeps a reading measure
// and the two side panels use the rest; each collapses on its own. Below
// 1000px the panels become sheets behind two buttons in the top bar, and the
// editor takes the width. This is the layout the developer chose on
// 2026-09-27 over a writing-first page and a timeline board: a studio, not a
// quick-post surface.
//
// Opening the Studio lands on a blank piece, ready to type into (dev,
// 2026-09-27). The row is not created until the first autosave, so opening
// and leaving never leaves an empty draft behind. "New ▾" in the top bar
// lists every kind; only writing has an editor yet.
//
// Focus mode (dev, 2026-10-03), the default: the writing room of the org
// sites (apps/amrit-canada/src/components/writing-room) in this package. One
// thin bar (menu, status, New, Preview, Publish) that dims while typing, a
// title and a body, and a side menu from the left holding the pieces drawer
// and the settings panel. It is the same tree as the full layout, restyled,
// so switching does not remount the editor. "Full studio" in the side menu
// restores the three columns; the choice is remembered per browser.
//
// Other kinds (dev, 2026-10-04): the host registers StudioExtensions
// (./frame.tsx). The bar then shows a kind switch; an extension's editor
// renders into the same three columns and puts its buttons in the bar.
// Focus mode belongs to writing; another kind always uses the full frame.
// ============================================================================

export const PERSONAL_ORG_ID = 'oad';

const UNTITLED = 'Untitled';

export interface StudioShellProps {
  viewer: StudioViewer;
  /** Orgs the person may act for. "Just me" is added by the shell. */
  orgs: StudioOrg[];
  /** Pieces for the initial org, so the first paint is not empty. */
  initialPieces: StudioPieceSummary[];
  initialOrgId?: string | null;
  initialPieceId?: string | null;
  actions: StudioActions;
  upload?: StudioUpload;
  links: StudioLinks;
  /** Kinds besides writing, registered by the host. */
  extensions?: StudioExtension[];
  /** `?kind=`: open on this kind; unknown ids fall back to writing. */
  initialKind?: string | null;
}

/** A piece that exists only in the browser until its first save. */
function blankPiece(orgId: string): StudioPiece {
  return {
    id: '',
    authorId: '',
    orgId,
    slug: '',
    title: '',
    lede: null,
    bodyHtml: '',
    coverImageUrl: null,
    status: 'draft',
    publishedAt: null,
    updatedAt: new Date().toISOString(),
    readingMinutes: null,
    bodyDoc: null,
    bodyFormat: 'html',
    layout: null,
    series: null,
    byline: null,
    seo: null,
  };
}

const BLOCKS_PREF = 'studio:blocks';
const FOCUS_PREF = 'studio:focus';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function StudioShell({
  viewer,
  orgs,
  initialPieces,
  initialOrgId,
  initialPieceId,
  actions,
  upload,
  links,
  extensions = [],
  initialKind,
}: StudioShellProps) {
  const [kind, setKind] = React.useState<string>(
    initialKind && extensions.some((e) => e.id === initialKind) ? initialKind : 'writing'
  );
  const ext = extensions.find((e) => e.id === kind) ?? null;
  const [actionsSlot, setActionsSlot] = React.useState<HTMLSpanElement | null>(null);
  const [statusSlot, setStatusSlot] = React.useState<HTMLSpanElement | null>(null);
  const allOrgs = React.useMemo<StudioOrg[]>(
    () => [{ orgId: PERSONAL_ORG_ID, name: 'Just me', slug: PERSONAL_ORG_ID }, ...orgs],
    [orgs]
  );
  const [orgId, setOrgId] = React.useState<string>(
    initialOrgId && allOrgs.some((o) => o.orgId === initialOrgId) ? initialOrgId : PERSONAL_ORG_ID
  );
  const org = allOrgs.find((o) => o.orgId === orgId) ?? allOrgs[0];

  const [pieces, setPieces] = React.useState<StudioPieceSummary[]>(initialPieces);
  const [pieceId, setPieceId] = React.useState<string | null>(initialPieceId ?? null);
  const [piece, setPiece] = React.useState<StudioPiece | null>(initialPieceId ? null : blankPiece(orgId));
  const [listing, setListing] = React.useState<StudioListing | null>(null);
  const [series, setSeries] = React.useState<Array<{ name: string; count: number }>>([]);
  const [identities, setIdentities] = React.useState<StudioIdentity[]>([]);
  React.useEffect(() => {
    void actions.listIdentities().then(setIdentities);
  }, [actions]);
  const refreshSeries = React.useCallback(() => void actions.listSeries().then(setSeries), [actions]);
  React.useEffect(() => {
    refreshSeries();
  }, [refreshSeries]);
  const [loading, setLoading] = React.useState(false);
  // Changes only when a different piece is opened, so the editor keeps its
  // state across the moment a blank piece gets its id.
  const [editorKey, setEditorKey] = React.useState(0);

  const [drawer, setDrawer] = React.useState(true);
  const [settings, setSettings] = React.useState(true);
  const [sheet, setSheet] = React.useState<null | 'drawer' | 'settings'>(null);
  const [menu, setMenu] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [blocks, setBlocks] = React.useState(false);
  const blocksPref = React.useRef(false);
  React.useEffect(() => {
    try {
      blocksPref.current = window.localStorage.getItem(BLOCKS_PREF) === '1';
      setBlocks(blocksPref.current);
    } catch {
      /* follow the piece */
    }
  }, []);
  const [save, setSave] = React.useState<SaveState>({ state: 'saved', at: null });
  const [error, setError] = React.useState<string | null>(null);

  const [focus, setFocus] = React.useState(true);
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(FOCUS_PREF) === '0') setFocus(false);
    } catch {
      /* stay focused */
    }
  }, []);
  function changeFocus(on: boolean) {
    setFocus(on);
    setSide(null);
    try {
      window.localStorage.setItem(FOCUS_PREF, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
  // The side menu in focus mode, and which of its two sections shows.
  const [side, setSide] = React.useState<null | 'pieces' | 'settings'>(null);
  // Where the editor puts the cover and standfirst in focus mode.
  const [asideSlot, setAsideSlot] = React.useState<HTMLDivElement | null>(null);
  const [words, setWords] = React.useState(0);
  // The bar dims while typing and comes back when the pointer moves.
  const [typing, setTyping] = React.useState(false);
  React.useEffect(() => {
    if (!typing) return;
    const wake = () => setTyping(false);
    window.addEventListener('mousemove', wake, { once: true });
    return () => window.removeEventListener('mousemove', wake);
  }, [typing]);
  React.useEffect(() => {
    if (!side) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSide(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [side]);

  // Light or dark, the Studio's own (dev, 2026-09-27). Unset follows the
  // viewer's colour scheme; the toggle pins one and remembers it per browser.
  const [theme, setTheme] = React.useState<'light' | 'dark' | null>(null);
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem('studio:theme');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      /* private mode or blocked storage: follow the system */
    }
  }, []);
  function toggleTheme() {
    const dark =
      theme === 'dark' ||
      (theme === null && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem('studio:theme', next);
    } catch {
      /* ignore */
    }
  }

  // The drawer follows the acting org: "Just me" is everything, an org is
  // what that org's site shows (homed there or listed there).
  const refreshPieces = React.useCallback(
    async (forOrg: string) => {
      const list = await actions.listPieces(forOrg === PERSONAL_ORG_ID ? null : forOrg);
      setPieces(list);
    },
    [actions]
  );

  const first = React.useRef(true);
  React.useEffect(() => {
    // The first org's pieces arrived with the page.
    if (first.current) {
      first.current = false;
      return;
    }
    void refreshPieces(orgId);
  }, [orgId, refreshPieces]);

  // Open an existing piece. A blank one is set directly by newPiece().
  React.useEffect(() => {
    if (!pieceId) return;
    let cancelled = false;
    setLoading(true);
    void actions.loadPiece(pieceId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res) {
        setError('That piece could not be opened.');
        setPieceId(null);
        setPiece(blankPiece(orgId));
        return;
      }
      setPiece(res.post);
      setListing(res.listing);
      setBlocks(res.post.bodyFormat === 'doc' || (res.post.bodyFormat === 'html' && blocksPref.current && !res.post.bodyHtml.trim()));
    });
    return () => {
      cancelled = true;
    };
    // orgId is only read for the fallback blank piece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceId, actions]);

  // Keep the address bar honest so a reload lands on the same piece.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (orgId === PERSONAL_ORG_ID) url.searchParams.delete('org');
    else url.searchParams.set('org', orgId);
    if (kind !== 'writing') {
      // The extension keeps its own `id` in the address.
      url.searchParams.set('kind', kind);
    } else {
      url.searchParams.delete('kind');
      if (pieceId) url.searchParams.set('id', pieceId);
      else url.searchParams.delete('id');
    }
    window.history.replaceState(null, '', url.toString());
  }, [orgId, pieceId, kind]);

  function switchKind(next: string) {
    setMenu(false);
    setSheet(null);
    setSide(null);
    if (next === kind) return;
    // An id in the address belongs to the kind that put it there.
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.replaceState(null, '', url.toString());
    setKind(next);
  }

  const onSaved = React.useCallback((saved: StudioPiece) => {
    setPiece(saved);
    setPieces((prev) => {
      const next = prev.map((p) => (p.id === saved.id ? summaryOf(saved) : p));
      return next.some((p) => p.id === saved.id) ? next : [summaryOf(saved), ...next];
    });
  }, []);

  function newPiece() {
    setMenu(false);
    setSheet(null);
    setSide(null);
    setPreview(false);
    setPieceId(null);
    setListing(null);
    setPiece(blankPiece(orgId));
    setSave({ state: 'saved', at: null });
    setBlocks(blocksPref.current);
    setEditorKey((k) => k + 1);
  }

  /** "Use blocks": switch the open piece's editor. On, the body is parsed into blocks; off, the canvas's HTML goes back to the small editor. */
  function useBlocks(on: boolean) {
    setBlocks(on);
    blocksPref.current = on;
    try {
      window.localStorage.setItem(BLOCKS_PREF, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    setEditorKey((k) => k + 1);
  }

  function openPiece(id: string) {
    setMenu(false);
    setSheet(null);
    setSide(null);
    setPreview(false);
    setSave({ state: 'saved', at: null });
    setPieceId(id);
    setEditorKey((k) => k + 1);
  }

  /**
   * The editor's save. A blank piece is created on its first save, under the
   * acting org and with "Untitled" until it has a title, then patched like
   * any other; the listing arrives with it so Show on fills in.
   */
  // The id a blank piece gets on its first save, held in a ref so a second
  // save that lands before React has re-rendered does not create another.
  const createdId = React.useRef<string | null>(null);
  React.useEffect(() => {
    createdId.current = null;
  }, [editorKey]);
  const savePiece = React.useCallback(
    async (patch: StudioPatch): Promise<StudioResult<StudioPiece>> => {
      const current = piece;
      if (!current) return { ok: false, error: 'Nothing open.' };
      const id0 = current.id || createdId.current;
      if (id0) return actions.savePiece(id0, patch);
      const title = patch.title?.trim() || UNTITLED;
      const started = await actions.startPiece(orgId, title);
      if (started.ok === false) return started;
      const id = started.value.id;
      createdId.current = id;
      const saved = await actions.savePiece(id, { ...patch, title });
      if (saved.ok === false) return saved;
      setPieceId(id);
      void actions.loadPiece(id).then((res) => res && setListing(res.listing));
      return saved;
    },
    [piece, orgId, actions]
  );

  async function setStatus(status: 'draft' | 'published') {
    if (!piece?.id) return;
    setSave({ state: 'saving', at: null });
    const res = await actions.savePiece(piece.id, { status });
    if (res.ok === false) {
      setError(res.error);
      setSave({ state: 'error', at: null });
      return;
    }
    onSaved(res.value);
    setSave({ state: 'saved', at: new Date().toISOString() });
  }

  async function setSeo(field: 'title' | 'description' | 'imageUrl' | 'noindex', value: string | boolean) {
    if (!piece?.id) return;
    const next = { ...(piece.seo ?? { title: null, description: null, imageUrl: null, noindex: false }), [field]: value };
    const res = await actions.savePiece(piece.id, { seo: next });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    onSaved(res.value);
  }

  async function setByline(id: string | null) {
    if (!piece?.id) return;
    const res = await actions.savePiece(piece.id, { bylineId: id });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    onSaved(res.value);
  }

  async function setPieceSeries(name: string | null) {
    if (!piece?.id) return;
    const res = await actions.savePiece(piece.id, { series: name });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    onSaved(res.value);
    refreshSeries();
  }

  async function setLayout(layout: StudioPiece['layout']) {
    if (!piece?.id) return;
    const res = await actions.savePiece(piece.id, { layout });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    onSaved(res.value);
  }

  async function remove() {
    if (!piece?.id) return;
    const res = await actions.removePiece(piece.id);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setPieces((prev) => prev.filter((p) => p.id !== piece.id));
    newPiece();
  }

  async function changeListing(next: string[]) {
    if (!piece?.id || !listing) return;
    const before = listing.selected;
    setListing({ ...listing, selected: next });
    const res = await actions.setListing(piece.id, next);
    if (res.ok === false) {
      setListing({ ...listing, selected: before });
      setError(res.error);
    }
  }

  const [seriesFilter, setSeriesFilter] = React.useState<string | null>(null);
  const [libOpen, setLibOpen] = React.useState(false);
  const [libSource, setLibSource] = React.useState<'mine' | 'org'>('mine');
  const libEndpoint =
    libSource === 'org' && orgId !== PERSONAL_ORG_ID && links.library?.org
      ? links.library.org.replace(':org', encodeURIComponent(org.slug))
      : links.library?.mine ?? null;
  const inSeries = (p: StudioPieceSummary) => !seriesFilter || p.series === seriesFilter;
  const drafts = pieces.filter((p) => p.status === 'draft' && inSeries(p));
  const published = pieces.filter((p) => p.status === 'published' && inSeries(p));

  const frameClass = [
    'studio-frame',
    drawer ? '' : 'studio-frame--no-drawer',
    settings ? '' : 'studio-frame--no-settings',
  ]
    .filter(Boolean)
    .join(' ');

  // Focus mode is writing's; any other kind gets the full frame.
  const layoutFocus = focus && !ext;
  const frameApi: StudioFrameApi = {
    orgId,
    orgs: allOrgs,
    viewer,
    setError,
    drawer,
    settings,
    sheet,
    setSheet,
    actionsSlot,
    statusSlot,
  };
  const kindSwitch =
    extensions.length > 0 ? (
      <div className="studio-kindsw" role="group" aria-label="Kind">
        <button type="button" aria-pressed={kind === 'writing'} onClick={() => switchKind('writing')}>
          Writing
        </button>
        {extensions.map((e) => (
          <button key={e.id} type="button" aria-pressed={kind === e.id} onClick={() => switchKind(e.id)}>
            {e.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      className={layoutFocus ? 'studio studio--focus' : 'studio'}
      data-theme={layoutFocus ? undefined : (theme ?? undefined)}
      data-typing={layoutFocus && typing ? 'true' : undefined}
      data-side={layoutFocus ? (side ?? undefined) : undefined}
    >
      {layoutFocus ? (
        <header className="studio-fbar">
          <button
            type="button"
            className="studio-fbtn studio-fbtn--menu"
            aria-expanded={side !== null}
            aria-label="Menu"
            title="Pieces and settings"
            onClick={() => setSide((s) => (s ? null : 'pieces'))}
          >
            ☰
          </button>
          <span className="studio-fstatus" aria-live="polite">
            {piece?.status === 'published' ? 'Published' : 'Draft'}
            {' · '}
            {save.state === 'saving'
              ? 'Saving…'
              : save.state === 'dirty'
                ? 'Unsaved'
                : save.state === 'error'
                  ? 'Not saved'
                  : save.at
                    ? `Saved ${fmtDate(save.at)}`
                    : piece?.id
                      ? 'Saved'
                      : 'New piece'}
            {words > 0 && ` · ${words} ${words === 1 ? 'word' : 'words'}`}
          </span>
          <span className="studio-spacer" />
          <button type="button" className="studio-fbtn" onClick={newPiece}>
            New
          </button>
          <button type="button" className="studio-fbtn" aria-pressed={preview} disabled={!piece} onClick={() => setPreview((v) => !v)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          {piece?.status === 'published' ? (
            <button type="button" className="studio-fbtn" onClick={() => void setStatus('draft')}>
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="studio-fbtn studio-fbtn--primary"
              disabled={!piece?.id}
              title={piece?.id ? undefined : 'Start writing; it saves itself, then you can publish'}
              onClick={() => void setStatus('published')}
            >
              Publish
            </button>
          )}
        </header>
      ) : (
      <header className="studio-top">
        <a className="studio-back" href={links.hubHref} title="Back to the hub">
          ←
        </a>
        <span className="studio-wordmark">Studio</span>
        {kindSwitch}
        <label className="studio-orgsel">
          <span>{ext ? 'Making as' : 'Writing as'}</span>
          <select
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              if (!ext) newPiece();
            }}
          >
            {allOrgs.map((o) => (
              <option key={o.orgId} value={o.orgId}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <div className="studio-menu">
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            New ▾
          </button>
          {menu && (
            <div className="studio-menu__list" role="menu">
              {STUDIO_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="menuitem"
                  className="studio-menu__item"
                  disabled={k.id !== 'writing' && !extensions.some((e) => e.id === k.id) && !k.href}
                  onClick={() => {
                    if (k.id === 'writing') {
                      switchKind('writing');
                      newPiece();
                    } else if (extensions.some((e) => e.id === k.id)) switchKind(k.id);
                    else if (k.href) window.location.assign(k.href);
                  }}
                >
                  <b>{k.label}</b>
                  {k.id !== 'writing' && !extensions.some((e) => e.id === k.id) && !k.href && <span className="studio-kind__soon">soon</span>}
                </button>
              ))}
              <div className="studio-menu__sep" />
              <button type="button" role="menuitem" className="studio-menu__item" disabled>
                <b>Gallery</b>
                <span className="studio-kind__soon">soon</span>
              </button>
              <button type="button" role="menuitem" className="studio-menu__item" disabled>
                <b>Document library</b>
                <span className="studio-kind__soon">soon</span>
              </button>
            </div>
          )}
        </div>
        <span className="studio-spacer" />
        {ext ? (
          <>
            <span className="studio-status" aria-live="polite" ref={setStatusSlot} />
            <span className="studio-actions" ref={setActionsSlot} />
            <button type="button" className="studio-btn studio-btn--icon" title="Light / dark" onClick={toggleTheme}>
              ◐
            </button>
            <button type="button" className="studio-btn studio-btn--mobile" onClick={() => setSheet(sheet === 'drawer' ? null : 'drawer')}>
              {ext.listLabel ?? 'List'}
            </button>
            <button type="button" className="studio-btn studio-btn--mobile" onClick={() => setSheet(sheet === 'settings' ? null : 'settings')}>
              Settings
            </button>
            <button type="button" className="studio-btn studio-btn--icon studio-btn--desktop" aria-pressed={drawer} title="List" onClick={() => setDrawer((v) => !v)}>
              ☰
            </button>
            <button type="button" className="studio-btn studio-btn--icon studio-btn--desktop" aria-pressed={settings} title="Settings panel" onClick={() => setSettings((v) => !v)}>
              ⚙
            </button>
          </>
        ) : (
        <>
        <span className="studio-status" aria-live="polite">
          {save.state === 'saving' && 'Saving…'}
          {save.state === 'dirty' && 'Unsaved changes'}
          {save.state === 'saved' && (piece?.id || save.at) && (
            <>
              Saved{save.at ? <b> {fmtDate(save.at)}</b> : null}
            </>
          )}
          {save.state === 'saved' && !piece?.id && !save.at && 'New piece'}
          {save.state === 'error' && <span className="studio-err">Not saved</span>}
        </span>
        <button type="button" className="studio-btn" title="A blank page and one thin bar" onClick={() => changeFocus(true)}>
          Focus
        </button>
        <button type="button" className="studio-btn studio-btn--icon" title="Light / dark" onClick={toggleTheme}>
          ◐
        </button>
        <button type="button" className="studio-btn studio-btn--mobile" onClick={() => setSheet(sheet === 'drawer' ? null : 'drawer')}>
          Pieces
        </button>
        <button type="button" className="studio-btn studio-btn--mobile" onClick={() => setSheet(sheet === 'settings' ? null : 'settings')}>
          Settings
        </button>
        <button
          type="button"
          className="studio-btn studio-btn--icon studio-btn--desktop"
          aria-pressed={drawer}
          title="Pieces list"
          onClick={() => setDrawer((v) => !v)}
        >
          ☰
        </button>
        <button
          type="button"
          className="studio-btn studio-btn--icon studio-btn--desktop"
          aria-pressed={settings}
          title="Settings panel"
          onClick={() => setSettings((v) => !v)}
        >
          ⚙
        </button>
        <button type="button" className="studio-btn" aria-pressed={preview} disabled={!piece} onClick={() => setPreview((v) => !v)}>
          {preview ? 'Editing' : 'Preview'}
        </button>
        {piece?.status === 'published' ? (
          <button type="button" className="studio-btn" onClick={() => void setStatus('draft')}>
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            disabled={!piece?.id}
            title={piece?.id ? undefined : 'Start writing; it saves itself, then you can publish'}
            onClick={() => void setStatus('published')}
          >
            Publish
          </button>
        )}
        </>
        )}
      </header>
      )}

      {error && (
        <div className="studio-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {ext ? (
        <StudioFrameContext.Provider value={frameApi}>{ext.render()}</StudioFrameContext.Provider>
      ) : (
      <div className={frameClass}>
        <aside className={`studio-drawer ${sheet === 'drawer' ? 'is-open' : ''}`} inert={focus && side !== 'pieces' ? true : undefined}>
          <div className="studio-panel">
            {links.library && (
              <>
                <div className="studio-panel__h">
                  <span>Library</span>
                  <button type="button" className="studio-btn studio-btn--ghost" style={{ padding: '2px 6px' }} onClick={() => setLibOpen((v) => !v)}>
                    {libOpen ? 'hide' : 'show'}
                  </button>
                </div>
                {libOpen && (
                  <div className="studio-lib">
                    {orgId !== PERSONAL_ORG_ID && links.library.org && (
                      <div className="studio-lib__tabs">
                        <button type="button" aria-pressed={libSource === 'mine'} onClick={() => setLibSource('mine')}>
                          My files
                        </button>
                        <button type="button" aria-pressed={libSource === 'org'} onClick={() => setLibSource('org')}>
                          {org.name}
                        </button>
                      </div>
                    )}
                    {libEndpoint && <MediaBrowser key={libEndpoint} endpoint={libEndpoint} emptyText="No pictures here yet." />}
                    <p className="studio-hint">Drag a picture onto the page, or onto the cover.</p>
                  </div>
                )}
              </>
            )}
            {series.length > 0 && (
              <>
                <div className="studio-panel__h">
                  <span>Series</span>
                  {seriesFilter && (
                    <button type="button" className="studio-btn studio-btn--ghost" style={{ padding: '2px 6px' }} onClick={() => setSeriesFilter(null)}>
                      all
                    </button>
                  )}
                </div>
                <div className="studio-list">
                  {series.map((s) => (
                    <button key={s.name} type="button" className="studio-row" aria-current={seriesFilter === s.name} onClick={() => setSeriesFilter(seriesFilter === s.name ? null : s.name)}>
                      <span className="studio-row__t">{s.name}</span>
                      <span className="studio-row__m">
                        <span>{s.count} {s.count === 1 ? 'piece' : 'pieces'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="studio-panel__h">
              <span>Drafts</span>
              <span>{drafts.length}</span>
            </div>
            <div className="studio-list">
              {drafts.length === 0 && <p className="studio-hint">Nothing in progress.</p>}
              {drafts.map((p) => (
                <PieceRow key={p.id} p={p} current={p.id === pieceId} onOpen={() => openPiece(p.id)} />
              ))}
            </div>
            <div className="studio-panel__h">
              <span>Published</span>
              <span>{published.length}</span>
            </div>
            <div className="studio-list">
              {published.length === 0 && <p className="studio-hint">Nothing published yet.</p>}
              {published.map((p) => (
                <PieceRow key={p.id} p={p} current={p.id === pieceId} onOpen={() => openPiece(p.id)} />
              ))}
            </div>
          </div>
        </aside>

        <main
          className="studio-main"
          onKeyDown={
            focus
              ? (e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) setTyping(true);
                }
              : undefined
          }
        >
          {loading ? (
            <div className="studio-empty">
              <p>Opening…</p>
            </div>
          ) : piece ? (
            <WritingEditor
              key={editorKey}
              piece={piece}
              preview={preview}
              authorName={piece.byline?.name ?? viewer.displayName}
              upload={upload ? { ...upload, fields: { ...(upload.fields ?? {}), orgSlug: org.slug } } : undefined}
              onSave={savePiece}
              onSaved={onSaved}
              onSaveState={setSave}
              blocks={blocks}
              searchThreads={actions.searchThreads}
              focus={focus}
              asideSlot={asideSlot}
              onWords={setWords}
            />
          ) : null}
        </main>

        <aside className={`studio-settings ${sheet === 'settings' ? 'is-open' : ''}`} inert={focus && side !== 'settings' ? true : undefined}>
          <div className="studio-panel">
            <div className="studio-panel__h">
              <span>Settings</span>
            </div>
            {focus && (
              <label className="studio-field">
                <span>Writing as</span>
                <select
                  value={orgId}
                  onChange={(e) => {
                    setOrgId(e.target.value);
                    newPiece();
                  }}
                >
                  {allOrgs.map((o) => (
                    <option key={o.orgId} value={o.orgId}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="studio-slot" ref={setAsideSlot} />
            <label className="studio-check studio-check--row">
              <input type="checkbox" checked={blocks} onChange={(e) => useBlocks(e.target.checked)} />
              Use blocks
            </label>
            <label className="studio-field">
              <span>Publish as</span>
              <select
                value={piece?.byline?.userId ?? viewer.userId}
                disabled={!piece?.id}
                onChange={(e) => void setByline(e.target.value === viewer.userId ? null : e.target.value)}
              >
                {identities.length === 0 && <option value={viewer.userId}>{viewer.displayName}</option>}
                {identities.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.relation === 'pseudonym' ? ' (pen name)' : i.relation === 'organization' ? ' (the org)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {piece?.id && listing ? (
              <>
                <div className="studio-field">
                  <span>Show on</span>
                  <div className="studio-checks">
                    {listing.orgs.map((o) => {
                      const isHome = o.orgId === listing.homeOrgId;
                      const on = isHome || listing.selected.includes(o.orgId);
                      return (
                        <label key={o.orgId} className="studio-check">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={isHome}
                            onChange={(e) =>
                              void changeListing(
                                e.target.checked ? [...listing.selected, o.orgId] : listing.selected.filter((x) => x !== o.orgId)
                              )
                            }
                          />
                          {o.name}
                        </label>
                      );
                    })}
                    {listing.orgs.length === 0 && <span className="studio-hint">Your directory page only.</span>}
                  </div>
                </div>
                <label className="studio-field">
                  <span>Series</span>
                  <select
                    value={piece.series ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__new') {
                        const name = window.prompt('Name the series');
                        if (name?.trim()) void setPieceSeries(name.trim());
                        e.target.value = piece.series ?? '';
                      } else {
                        void setPieceSeries(e.target.value || null);
                      }
                    }}
                  >
                    <option value="">Not in a series</option>
                    {series.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.count})
                      </option>
                    ))}
                    {piece.series && !series.some((s) => s.name === piece.series) && <option value={piece.series}>{piece.series}</option>}
                    <option value="__new">New series…</option>
                  </select>
                </label>
                <label className="studio-field">
                  <span>Layout</span>
                  <select
                    value={piece.layout ?? ''}
                    onChange={(e) => void setLayout(e.target.value ? (e.target.value as StudioPiece['layout']) : null)}
                  >
                    <option value="">Essay (default)</option>
                    {STUDIO_LAYOUTS.filter((l) => l.id !== 'essay').map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label} — {l.hint}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="studio-field">
                  <span>Who can see</span>
                  <select value="public" disabled>
                    <option value="public">Everyone</option>
                  </select>
                </label>
                <div className="studio-field">
                  <span>Address</span>
                  {links.pieceBase ? (
                    <a className="studio-addr" href={`${links.pieceBase}/${piece.slug}`} target="_blank" rel="noreferrer">
                      {`${links.pieceBase}/${piece.slug}`.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    <span className="studio-addr">…/{piece.slug}</span>
                  )}
                </div>
                <div className="studio-panel__h">
                  <span>Search and sharing</span>
                </div>
                <SeoField label="Title for search" value={piece.seo?.title ?? ''} placeholder={piece.title || 'Defaults to the title'} onCommit={(v) => void setSeo('title', v)} />
                <SeoField label="Description" value={piece.seo?.description ?? ''} placeholder={piece.lede || 'Defaults to the standfirst'} onCommit={(v) => void setSeo('description', v)} multiline />
                <SeoField label="Share image URL" value={piece.seo?.imageUrl ?? ''} placeholder={piece.coverImageUrl ? 'Defaults to the cover' : 'None'} onCommit={(v) => void setSeo('imageUrl', v)} />
                <label className="studio-check studio-check--row">
                  <input type="checkbox" checked={!piece.seo?.noindex} onChange={(e) => void setSeo('noindex', !e.target.checked)} />
                  Let search engines index this
                </label>
                <div className="studio-panel__h">
                  <span>History</span>
                </div>
                <div className="studio-history">
                  <div>
                    <span>Updated</span>
                    <span>{fmtDate(piece.updatedAt)}</span>
                  </div>
                  {piece.publishedAt && (
                    <div>
                      <span>Published</span>
                      <span>{fmtDate(piece.publishedAt)}</span>
                    </div>
                  )}
                  {piece.readingMinutes != null && (
                    <div>
                      <span>Reading time</span>
                      <span>{piece.readingMinutes} min</span>
                    </div>
                  )}
                </div>
                <RemoveButton onConfirm={remove} />
              </>
            ) : (
              <p className="studio-hint">
                {orgId === PERSONAL_ORG_ID
                  ? 'A new piece goes on your directory page. Where else it shows is set once it has saved.'
                  : `A new piece is yours and is listed on ${org.name}. Where else it shows is set once it has saved.`}
              </p>
            )}
          </div>
        </aside>
      </div>
      )}
      {layoutFocus && (
        <div className="studio-side__head" inert={side ? undefined : true}>
          <div className="studio-side__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={side === 'pieces'} onClick={() => setSide('pieces')}>
              Pieces
            </button>
            <button type="button" role="tab" aria-selected={side === 'settings'} onClick={() => setSide('settings')}>
              Settings
            </button>
            <span className="studio-spacer" />
            <button type="button" className="studio-fbtn" aria-label="Close" onClick={() => setSide(null)}>
              ✕
            </button>
          </div>
          <div className="studio-side__links">
            <button type="button" onClick={() => changeFocus(false)}>
              Full studio
            </button>
            {extensions.map((e) => (
              <button key={e.id} type="button" onClick={() => switchKind(e.id)}>
                {e.label}
              </button>
            ))}
            <a href={links.hubHref}>Back to the hub</a>
          </div>
        </div>
      )}
      {layoutFocus && side && <button type="button" className="studio-scrim studio-scrim--side" aria-label="Close menu" onClick={() => setSide(null)} />}
      {(sheet || menu) && (
        <button
          type="button"
          className={`studio-scrim ${menu && !sheet ? 'studio-scrim--clear' : ''}`}
          aria-label="Close"
          onClick={() => {
            setSheet(null);
            setMenu(false);
          }}
        />
      )}
    </div>
  );
}

/** A text field that saves when it loses focus or on Enter, so a keystroke is not a save. */
function SeoField({ label, value, placeholder, onCommit, multiline }: { label: string; value: string; placeholder?: string; onCommit: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea className="studio-field__text" rows={2} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input className="studio-field__text" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      )}
    </label>
  );
}

function summaryOf(p: StudioPiece): StudioPieceSummary {
  const { id, slug, title, lede, coverImageUrl, status, publishedAt, updatedAt, readingMinutes, series } = p;
  return { id, slug, title, lede, coverImageUrl, status, publishedAt, updatedAt, readingMinutes, series };
}

function PieceRow({ p, current, onOpen }: { p: StudioPieceSummary; current: boolean; onOpen: () => void }) {
  return (
    <button type="button" className="studio-row" aria-current={current} onClick={onOpen}>
      <span className="studio-row__t">{p.title || UNTITLED}</span>
      <span className="studio-row__m">
        <span className={`studio-pill studio-pill--${p.status}`}>{p.status}</span>
        <span>{fmtDate(p.status === 'published' ? p.publishedAt : p.updatedAt)}</span>
      </span>
    </button>
  );
}

/** Two clicks to remove; the second is offered for four seconds. */
function RemoveButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [arm, setArm] = React.useState(false);
  React.useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 4000);
    return () => clearTimeout(t);
  }, [arm]);
  return arm ? (
    <div className="studio-rail">
      <button type="button" className="studio-btn studio-btn--danger" onClick={() => void onConfirm()}>
        Remove for good
      </button>
      <button type="button" className="studio-btn studio-btn--ghost" onClick={() => setArm(false)}>
        Keep
      </button>
    </div>
  ) : (
    <div className="studio-rail">
      <button type="button" className="studio-btn studio-btn--ghost studio-btn--dangertext" onClick={() => setArm(true)}>
        Remove
      </button>
    </div>
  );
}
