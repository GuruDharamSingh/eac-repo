'use client';

// Small pieces the Site Builder face, pop-up and detail page share.

import * as React from 'react';
import type { HubCardHost } from '../contract';
import { Tag } from '../ui/primitives';
import type { OrgIdentity, OrgKind, PageKind, SiteBuilderCan, SitePage, SiteThemeSummary, ThemeColors } from './model';
import { LOOK_NOTE, ORG_KINDS } from './model';

export const hairline = '1px solid color-mix(in srgb, var(--hc-text) 8%, transparent)';

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ── time ──────────────────────────────────────────────────────────────

/** "Just now", "40 minutes ago", "Yesterday", "3 days ago", "3 weeks ago", "2 months ago". null → "not yet". */
export function when(iso: string | null, now = Date.now()): string {
  if (!iso) return 'not yet';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'not yet';
  const mins = Math.max(0, (now - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${plural(Math.floor(mins), 'minute')} ago`;
  const hours = mins / 60;
  if (hours < 24) return `${plural(Math.floor(hours), 'hour')} ago`;
  const days = Math.floor(hours / 24);
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${plural(Math.floor(days / 7), 'week')} ago`;
  if (days < 365) return `${plural(Math.floor(days / 30), 'month')} ago`;
  return `${plural(Math.floor(days / 365), 'year')} ago`;
}

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "2 days ago · Mara". */
export function editedLine(p: Pick<SitePage, 'updatedAt' | 'updatedBy'>): string {
  const w = when(p.updatedAt);
  return p.updatedBy ? `${w} · ${p.updatedBy}` : w;
}

/** "Edited yesterday by Theo". */
export function editedBy(p: Pick<SitePage, 'updatedAt' | 'updatedBy'>): string {
  return `Edited ${lowerFirst(when(p.updatedAt))}${p.updatedBy ? ` by ${p.updatedBy}` : ''}`;
}

export const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── pages ─────────────────────────────────────────────────────────────

/** "/about", "/" for home; a path-less page that isn't home (the header and footer) is on every page. */
export function pathText(p: Pick<SitePage, 'id' | 'path'>): string {
  if (p.path === '' && p.id !== '') return 'On every page';
  return '/' + p.path;
}

export const isSharedLayout = (p: SitePage) => p.sharedLayoutFor !== null;

/** The page whose path is this page's parent path. */
export function parentOf(p: SitePage, pages: SitePage[]): SitePage | null {
  if (p.depth < 1 || !p.path.includes('/')) return null;
  const pp = p.path.slice(0, p.path.lastIndexOf('/'));
  return pages.find((x) => x.path === pp) ?? null;
}

const stamp = (p: SitePage) => (p.updatedAt ? new Date(p.updatedAt).getTime() : 0);

/** Most recently saved editor page, or null. */
export function lastEditorPage(pages: SitePage[]): SitePage | null {
  const list = pages.filter((p) => p.kind === 'editor');
  if (list.length === 0) return null;
  return list.reduce((a, b) => (stamp(b) > stamp(a) ? b : a));
}

export function kindCounts(pages: SitePage[]) {
  const editor = pages.filter((p) => p.kind === 'editor').length;
  return { editor, template: pages.length - editor };
}

export function kindSplitText(pages: SitePage[]): string {
  const { editor, template } = kindCounts(pages);
  const n = pages.length;
  if (n === 0) return '';
  if (template === 0) return n === 2 ? 'Both built in the editor' : 'All built in the editor';
  if (editor === 0) return n === 2 ? 'Both fixed templates with copy slots' : 'All fixed templates with copy slots';
  return `${editor} built in the editor · ${template} fixed templates`;
}

export function KindTag({ kind }: { kind: PageKind }) {
  return <Tag tone={kind === 'editor' ? 'editor' : 'template'}>{kind === 'editor' ? 'Editor' : 'Template'}</Tag>;
}

// ── theme ─────────────────────────────────────────────────────────────

export const lookName = (look: SiteThemeSummary['look']) => LOOK_NOTE[look].name;

/** A CSS font-family value for a font name from data. */
export const fontStack = (name: string, fallback = 'serif') => `'${name.replace(/'/g, '')}', ${fallback}`;

/** Site colours with a page's exception laid over. DATA colours: the one place hub styling doesn't apply. */
export function colorsFor(theme: SiteThemeSummary, page?: SitePage | null): ThemeColors {
  return { ...theme.colors, ...(page?.exception ?? {}) };
}

export function Swatch({ color, w = 22, h = 22 }: { color: string; w?: number; h?: number }) {
  return <span style={{ display: 'block', width: w, height: h, flex: 'none', background: color }} />;
}

/** Paper, surface, ink, accent, second accent. */
export function SwatchRow({ colors, size = 22, framed = true, gap = 0 }: { colors: ThemeColors; size?: number; framed?: boolean; gap?: number }) {
  const list = [colors.paper, colors.surface, colors.ink, colors.accent, colors.accent2];
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', flex: 'none', gap,
        border: framed ? '1px solid var(--hc-divider)' : undefined,
      }}
    >
      {list.map((c, i) => <Swatch key={i} color={c} w={size} h={size} />)}
    </span>
  );
}

/** The role names a page exception overrides, lowercase: "second accent, accent". */
export function exceptionRoles(p: SitePage, roleName: Record<string, string>): string {
  return Object.keys(p.exception ?? {}).map((k) => (roleName[k] ?? k).toLowerCase()).join(', ');
}

// ── identity ──────────────────────────────────────────────────────────

export const kindName = (k: OrgKind | null): string => ORG_KINDS.find((x) => x.id === k)?.name ?? '';

/** "Collective, also artist, store, gatherings". */
export function kindLine(id: Pick<OrgIdentity, 'primaryKind' | 'alsoKinds'>): string {
  if (!id.primaryKind) return '';
  const also = id.alsoKinds.filter((k) => k !== id.primaryKind);
  return kindName(id.primaryKind) + (also.length ? ', also ' + also.map((k) => kindName(k).toLowerCase()).join(', ') : '');
}

// ── navigation ────────────────────────────────────────────────────────

export function go(host: HubCardHost, href: string | null | undefined) {
  if (!href) return;
  if (host.navigate) host.navigate(href);
  else if (typeof window !== 'undefined') window.location.assign(href);
}

/** The editor link for a page, or null when the host has no editor (hide editor-only buttons). */
export function editHref(host: HubCardHost, path: string): string | null {
  return host.puckEditHref ? host.puckEditHref(path) : null;
}

// ── a hand-off between the three states ───────────────────────────────
// nav.openPopup() and nav.openDetail() carry no payload, and the pop-up and the detail page
// are separate components. Face/Popup leave a one-shot note here; the next state reads it on mount.

export interface SiteIntent {
  /** Pop-up: expand this page's copy (id may be '' for home). */
  expand?: string;
  /** Detail: open the New page dialog. */
  newPage?: boolean;
  /** Detail: preselect this page in the Theme tab's add-exception row. */
  themePick?: string;
}
let pending: SiteIntent | null = null;
export const leaveIntent = (i: SiteIntent) => { pending = i; };
export const peekIntent = (): SiteIntent | null => pending;
export const clearIntent = () => { pending = null; };

// ── gates ─────────────────────────────────────────────────────────────

/** What a viewer without a store-backed feature still sees; kept in one place. */
export const NO_KINDS_HINT = 'Coming with the next database update.';

export type CanFlags = SiteBuilderCan;

// ── small atoms ───────────────────────────────────────────────────────

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="hc-overline" style={style}>{children}</div>;
}

export function SectionHead({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--hc-font-heading)',
        fontWeight: 'var(--hc-heading-weight)', fontSize: size, lineHeight: 1.2,
      }}
    >
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--hc-divider)' }} />
    </div>
  );
}
