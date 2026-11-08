// Harness: the real Site Builder card (packages/hub/src/site-builder) on the design's sample data
// (docs/open/hub-cards-handoff/source/SiteBuilderCard.dc.html seed()). No server, no database:
// host.act resolves { ok: true } after 600 ms and logs.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { HubRoot, lucideHubIcons } from '@elkdonis/hub/ui';
import { siteBuilderCard } from '@elkdonis/hub/site-builder';
import type { SiteBuilderHost } from '@elkdonis/hub/site-builder';
import type { HubNav } from '@elkdonis/hub/contract';
import type {
  CopySlot, OrgIdentity, PageKind, SavedTemplate, SiteBuilderCan, SiteBuilderDetailData, SiteBuilderFaceData, SitePage,
  SiteThemeSummary, SlotType, ThemeColors,
} from '@elkdonis/hub/site-builder/model';

type OrgKey = 'ifac' | 'bookreaders';

const NOW = Date.now();
const iso = (min: number) => new Date(NOW - min * 60000).toISOString();
const initialsOf = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('');

// ── sample thumbnails (a stand-in for the page screenshots taken on save) ───────────────────

function thumb(shape: string, c: ThemeColors): string {
  const W = 320, H = 200;
  const r = (x: number, y: number, w: number, h: number, f: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
  let s = r(0, 0, W, H, c.paper) + r(0, 0, W, 26, c.surface) + r(0, 25, W, 1, c.line) + r(14, 9, 60, 8, c.ink);
  s += r(220, 10, 24, 6, c.ink) + r(252, 10, 24, 6, c.ink) + r(284, 10, 24, 6, c.accent);
  if (shape === 'hero') s += r(0, 26, W, 96, c.accent2) + r(24, 56, 140, 14, c.paper) + r(24, 78, 90, 7, c.paper) + r(24, 96, 54, 14, c.accent) + r(24, 140, 80, 40, c.surface) + r(112, 140, 80, 40, c.surface) + r(200, 140, 80, 40, c.surface);
  else if (shape === 'split') s += r(20, 44, 130, 100, c.accent2) + r(170, 50, 120, 12, c.ink) + r(170, 74, 120, 6, c.line) + r(170, 88, 110, 6, c.line) + r(170, 102, 120, 6, c.line) + r(170, 124, 50, 14, c.accent);
  else if (shape === 'grid') s += [0, 1, 2, 3, 4, 5].map((i) => r(20 + (i % 3) * 98, 44 + Math.floor(i / 3) * 74, 90, 66, i % 2 ? c.accent2 : c.surface)).join('');
  else if (shape === 'list') s += [0, 1, 2, 3].map((i) => r(20, 42 + i * 36, 280, 28, c.surface) + r(28, 52 + i * 36, 120, 7, c.ink)).join('');
  else s += r(60, 44, 200, 12, c.ink) + [0, 1, 2, 3, 4, 5].map((i) => r(60, 72 + i * 18, i % 3 === 2 ? 130 : 200, 6, c.line)).join('');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${s}</svg>`);
}

// ── sample data ────────────────────────────────────────────────────────────────

let slotN = 0;
const S = (group: string, label: string, type: SlotType, value: string, hint?: string, rows?: number): CopySlot => ({
  key: `${group.toLowerCase().replace(/[^a-z]+/g, '-')}.${label.toLowerCase().replace(/[^a-z]+/g, '-')}.${slotN++}`,
  group, label, type, value, hint, rows, section: group.toLowerCase().replace(/[^a-z]+/g, '_'), field: label.toLowerCase().replace(/[^a-z]+/g, '_'),
});

interface Seed {
  kind: PageKind; title: string; path: string; shape: string; mins: number; by: string; notes: string;
  shared?: string; slots?: CopySlot[]; id?: string;
}
const B = (title: string, path: string, shape: string, mins: number, by: string, notes: string, shared?: string): Seed =>
  ({ kind: 'editor', title, path, shape, mins, by, notes, shared });
const T = (title: string, path: string, shape: string, mins: number, by: string, notes: string, slots: CopySlot[]): Seed =>
  ({ kind: 'template', title, path, shape, mins, by, notes, slots });

const IFAC_THEME: SiteThemeSummary = {
  look: 'framed', headingFont: 'Libre Caslon Text', bodyFont: 'Source Sans 3',
  colors: { paper: '#f8f5ef', surface: '#fffdf8', ink: '#171615', line: '#d8d0c2', accent: '#9a3f2f', accent2: '#273d54', frame: '#9c40d8' },
};
const BOOK_THEME: SiteThemeSummary = {
  look: 'paper', headingFont: 'Spectral', bodyFont: 'Source Sans 3',
  colors: { paper: '#f3eee4', surface: '#fbf8f1', ink: '#1f2a44', line: '#d6cbb8', accent: '#8a4b22', accent2: '#2f4a3a', frame: '#1f2a44' },
};

const IFAC_SEED: Seed[] = [
  B('Home', '', 'hero', 2900, 'Mara', 'Front door. The weekly meeting band stays at the top; change the hero image each season.'),
  B('About', 'about', 'split', 30000, 'Julien', ''),
  B('Exhibitions', 'exhibitions', 'grid', 1400, 'Theo', 'Current show first, then past shows by year.'),
  B('After-Image', 'exhibitions/after-image', 'hero', 40, 'Julien', 'Runs to Dec 20. Take the RSVP block down after the closing night.'),
  B('Visit', 'visit', '', 7200, 'Ana', ''),
  B('Collecting guide', 'collecting', '', 90000, 'Mara', 'Written for first-time buyers. Keep it under 800 words.'),
  B('Membership', 'membership', 'split', 10000, 'Mara', ''),
  B('Events', 'events', 'list', 5800, 'Theo', ''),
  B('Event page layout', 'events/…', 'split', 31000, 'Kofi', 'Changes here reach every event page at once.', 'Draws every event page'),
  B('Writing', 'writing', 'list', 20000, 'Hana', ''),
  B('Writing piece layout', 'writing/…', 'text', 45000, 'Hana', '', 'Draws every piece of writing'),
  B('Store', 'store', 'grid', 8600, 'Julien', 'Listings come from the marketplace. Only the intro and layout are edited here.'),
  B('Press', 'press', '', 130000, 'Ana', ''),
  B('Contact', 'contact', 'text', 88500, 'Mara', ''),
  T('Artists', 'artists', 'grid', 1500, 'Theo', 'The intro is the first thing a collector reads. Keep it to two sentences.', [
    S('Top of the page', 'Heading', 'text', 'Artists'),
    S('Top of the page', 'Intro', 'textarea', 'Painters, printmakers and sculptors who show with IFAC. Each has a page of their own.', undefined, 3),
    S('Top of the page', 'Banner image', 'image', 'artists-banner.jpg', 'Wide, about 3 : 1.'),
  ]),
  T('Dealers', 'dealers', 'grid', 21000, 'Theo', '', [
    S('Top of the page', 'Heading', 'text', 'Dealers'),
    S('Top of the page', 'Intro', 'textarea', 'Galleries and private dealers we work with, from New York to Buenos Aires.', undefined, 3),
  ]),
  T('Forum', 'forum', 'list', 46000, 'Kofi', '', [
    S('Top of the page', 'Heading', 'text', 'Forum'),
    S('Top of the page', 'Intro', 'textarea', 'What is being discussed, every board in full.', undefined, 2),
  ]),
  T('Join', 'join', '', 170000, 'Mara', '', [
    S('Sign-up', 'Heading', 'text', 'Join IFAC'),
    S('Sign-up', 'Button', 'text', 'Create an account'),
    S('Sign-up', 'What an account gives you', 'textarea', 'An account lets you RSVP to meetings, follow artists and post to the forum.', undefined, 3),
  ]),
  T('Members’ hub', 'hub', 'grid', 30500, 'Mara', '', [
    S('Greeting', 'Greeting', 'text', 'Welcome back, {name}.', 'Put {name} where the person’s first name goes.'),
    S('Greeting', 'Line under the greeting', 'textarea', 'Here is what the collective has on, and what you can add to it.', undefined, 2),
  ]),
  { ...T('Header & footer', '', 'chrome', 220000, 'Julien', '', [
    S('Header', 'Site name', 'text', 'International Fine Art Collectors'),
    S('Header', 'Tagline', 'text', 'New York · Paris · Vancouver · San Francisco · Buenos Aires'),
    S('Footer', 'Footer note', 'textarea', 'International Fine Art Collectors is part of the Elkdonis Arts network.', undefined, 2),
  ]), id: 'chrome' },
];

const BOOK_SEED: Seed[] = [
  T('Home', '', 'hero', 4300, 'Ruth', 'The landing page. The book and Books ahead change when a new reading starts; the rest rarely moves.', [
    S('Hero', 'Hero image slide', 'image', 'reading-room.jpg', 'Optional. With no image the hero has one slide fewer.'),
    S('Hero', 'Caption', 'text', 'Reading the Fourth Way together, one book at a time.'),
    S('Vertical banner', 'Banner image', 'image', '', 'Tall and narrow, about 1 : 3.4. Left empty, a book spine is drawn.'),
    S('Vertical banner', 'Where it links', 'url', '/groups'),
    S('The book', 'Title', 'text', 'In Search of the Miraculous'),
    S('The book', 'Author', 'text', 'P. D. Ouspensky'),
    S('The book', 'Why this book', 'textarea', 'Ouspensky’s account of his years with Gurdjieff is where most of us started. We read it slowly, a chapter a fortnight.', undefined, 3),
    S('Structure of a meeting', 'How a meeting runs', 'textarea', 'Five minutes of quiet to arrive.\nRead aloud, a paragraph each.\nStop where something lands and talk about it.\nClose with one question to carry into the week.', 'One step per line.', 4),
    S('Books ahead', 'Next books', 'textarea', 'The Fourth Way — P. D. Ouspensky\nViews from the Real World — G. I. Gurdjieff\nBeelzebub’s Tales to His Grandson — G. I. Gurdjieff', 'One per line: title — author.', 3),
    S('Mission', 'The line under the two columns', 'textarea', '', 'Left empty, the site’s default line is used.', 2),
  ]),
  T('About', 'about', 'text', 88000, 'Ruth', '', [
    S('About', 'The About page', 'rich', 'We are a small group of readers who meet online every other Tuesday. Nobody teaches; we read aloud and talk about what we notice.\n\nAnyone can join a reading group. Start with whichever book is current.', 'Headings, lists, bold and links are kept.', 6),
  ]),
];

const markSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" fill="#273d54"/><path d="M8 34 22 8l14 26z" fill="none" stroke="#f8f5ef" stroke-width="2"/></svg>');

interface OrgSeed {
  seed: Seed[]; theme: SiteThemeSummary; org: SiteBuilderFaceData['org']; identity: OrgIdentity;
  exceptions: Record<string, Partial<ThemeColors>>; templates: SavedTemplate[];
}
const ORGS: Record<OrgKey, OrgSeed> = {
  ifac: {
    seed: IFAC_SEED, theme: IFAC_THEME, org: { name: 'IFAC', mark: 'IF', domain: 'ifacgroup.com' },
    identity: {
      name: 'International Fine Art Collectors', line: 'Collectors, artists and dealers who meet each week around one work.',
      where: 'New York · Paris · Vancouver · San Francisco · Buenos Aires', markUrl: markSvg, markName: 'ifac-mark.png',
      primaryKind: 'collective', alsoKinds: ['artist', 'store', 'gatherings'],
    },
    exceptions: { 'exhibitions/after-image': { accent2: '#596b55', accent: '#7a5a1e' }, hub: { surface: '#ffffff' } },
    templates: [
      { id: 'exhibition', name: 'Exhibition', description: 'Hero image, dates and hours, the artists in the show, an RSVP block for the opening.', fromPage: 'After-Image', createdBy: 'Julien', createdAt: '2026-10-12T10:00:00Z', blockCount: 9 },
      { id: 'spotlight', name: 'Artist spotlight', description: 'Portrait beside a short bio, three works, an enquiry form.', fromPage: 'About', createdBy: 'Theo', createdAt: '2026-09-03T10:00:00Z', blockCount: 6 },
    ],
  },
  bookreaders: {
    seed: BOOK_SEED, theme: BOOK_THEME, org: { name: 'Fourth Way Book Readers', mark: 'FW', domain: 'elkdonis-arts.org/books' },
    identity: {
      name: 'Fourth Way Book Readers', line: 'Reading the Fourth Way together, one book at a time.', where: 'Online', markUrl: null, markName: null,
      primaryKind: 'gatherings', alsoKinds: ['writing'],
    },
    exceptions: {}, templates: [],
  },
};

const PAGE_STARTS = [
  { id: 'blank', name: 'Blank', note: 'An empty page. Add blocks in the editor.' },
  { id: 'services', name: 'Services', note: 'Services as cards, one in full, a booking form.' },
  { id: 'writing', name: 'Writing', note: 'An index of pieces from the writing room.' },
];

const ALL_CAN: SiteBuilderCan = { editPages: true, createPages: true, editTheme: true, editIdentity: true, notes: true, savedTemplates: true, kinds: true };

function detail(org: OrgKey, can: SiteBuilderCan): SiteBuilderDetailData {
  const o = ORGS[org];
  const pages: SitePage[] = o.seed.map((s) => {
    const id = s.id ?? s.path;
    const depth = s.path ? s.path.split('/').length - 1 : 0;
    return {
      id, title: s.title, path: s.path, depth, kind: s.kind,
      thumbnailUrl: s.shape && s.shape !== 'chrome' ? thumb(s.shape, o.theme.colors) : null,
      updatedAt: iso(s.mins), updatedBy: s.by,
      notes: can.notes ? s.notes : null, linkPreview: null, sharedLayoutFor: s.shared ?? null,
      copySlots: s.slots ?? [], exception: o.exceptions[id] ?? null,
    };
  });
  const lastEdited = pages.slice().sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0] ?? null;
  const identity = can.kinds ? o.identity : { ...o.identity, primaryKind: null, alsoKinds: [] };
  return { org: o.org, pages, lastEdited, theme: o.theme, identity, can, savedTemplates: can.savedTemplates ? o.templates : [], pageStarts: PAGE_STARTS };
}

// ── host stub ────────────────────────────────────────────────────────────────

const host: SiteBuilderHost = {
  studioHref: () => '#',
  hubHref: (card, tab) => `#/hub/${card}${tab ? '?tab=' + tab : ''}`,
  liveHref: (path) => '#/' + path,
  puckEditHref: (p) => '/studio/' + p,
  themeEditorHref: (p) => '/theme-editor' + (p ? '?page=' + p : ''),
  async act(actionId, input) {
    console.log('act', actionId, JSON.stringify(input));
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  },
  async uploadImage(file) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, value: { url: '/uploads/' + file.name, name: file.name } };
  },
  navigate: (href) => console.log('navigate', href),
  refresh: () => console.log('refresh'),
  icons: lucideHubIcons,
};
const hostNoEditor: SiteBuilderHost = { ...host, puckEditHref: undefined, themeEditorHref: undefined };

// ── driving the real controls ─────────────────────────────────────────────────

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null, value: string) {
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const byLabel = <T extends HTMLElement>(label: string, tag: string) => {
  const l = [...document.querySelectorAll<HTMLLabelElement>('label')].find((e) => e.textContent?.trim().startsWith(label));
  const id = l?.getAttribute('for');
  return (id ? document.getElementById(id) : null) as T | null;
};
function typeLabel(label: string, value: string) { setValue(byLabel<HTMLInputElement>(label, 'input'), value); }
function pickOption(label: string, optionText: string) {
  const sel = byLabel<HTMLSelectElement>(label, 'select');
  const opt = sel && [...sel.options].find((o) => o.textContent?.replace(/\s+/g, ' ').trim().startsWith(optionText));
  if (sel && opt) setValue(sel, opt.value);
}
function clickText(text: string, tag = 'button') {
  const el = [...document.querySelectorAll<HTMLElement>(tag)].find((e) => e.textContent?.trim().startsWith(text));
  el?.click();
}
function clickRow(title: string) {
  const el = [...document.querySelectorAll<HTMLElement>('.hc-row-head')].find((e) => e.textContent?.includes(title));
  el?.click();
}
function clickRowButton(title: string, button: string) {
  const row = [...document.querySelectorAll<HTMLElement>('.hc-row')].find((e) => e.querySelector('.hc-row-head')?.textContent?.includes(title));
  [...(row?.querySelectorAll<HTMLElement>('button') ?? [])].find((b) => b.textContent?.trim().startsWith(button))?.click();
}

// ── pages ──────────────────────────────────────────────────────────────────

const PLAIN_VARS: Record<string, string> = {
  '--sf-bg': '#faf6ef', '--sf-fg': '#2a2118', '--sf-accent': '#a4552a', '--sf-line': '#ddd2c0',
  '--sf-font-title': 'Georgia, "Times New Roman", serif', '--sf-font-body': 'system-ui, sans-serif',
  '--eac-hub-accent-100': '#f8ece3', '--eac-hub-accent-200': '#f0d8c6', '--eac-hub-accent-300': '#e5bd9f',
  '--eac-hub-accent-400': '#d29a72', '--eac-hub-accent-500': '#bf7a4d', '--eac-hub-accent-600': '#a4552a',
  '--eac-hub-accent-700': '#86431f', '--eac-hub-accent-800': '#63321a', '--eac-hub-accent-900': '#3f2111',
  '--eac-hub-on-accent': '#ffffff', '--eac-hub-radius': '3px',
  '--eac-hub-neutral-100': '#f6f2ea', '--eac-hub-neutral-200': '#ebe4d6', '--eac-hub-neutral-300': '#ddd2c0',
  '--eac-hub-neutral-400': '#c3b6a0', '--eac-hub-neutral-500': '#a39580', '--eac-hub-neutral-600': '#85786a',
  '--eac-hub-neutral-700': '#6a5f52', '--eac-hub-neutral-800': '#4d443a', '--eac-hub-neutral-900': '#2f2922',
};

interface Cfg {
  org: OrgKey; start: 'card' | 'popup' | 'detail'; tab?: string; plain?: boolean; can?: Partial<SiteBuilderCan>; noEditor?: boolean;
  drive?: Array<() => void>;
}
const O = (o: Partial<Cfg>): Cfg => ({ org: 'ifac', start: 'detail', ...o });

const PAGES: Record<string, Cfg> = {
  'sb-card': O({ start: 'card' }),
  'sb-card-bookreaders': O({ start: 'card', org: 'bookreaders' }),
  'sb-popup': O({ start: 'popup' }),
  'sb-popup-template': O({ start: 'popup', org: 'bookreaders', drive: [() => clickRowButton('Home', 'Edit copy')] }),
  'sb-pages': O({ tab: 'pages' }),
  'sb-pages-grid': O({ tab: 'pages' }),
  'sb-pages-list': O({ tab: 'pages', drive: [() => clickText('List')] }),
  'sb-pages-expanded-editor': O({ tab: 'pages', drive: [() => clickText('List'), () => clickRow('After-Image')] }),
  'sb-pages-expanded-template': O({ tab: 'pages', drive: [() => clickText('List'), () => clickRow('Artists')] }),
  'sb-bookreaders': O({ tab: 'pages', org: 'bookreaders', drive: [() => clickRow('Home')] }),
  'sb-new-page': O({ tab: 'pages', drive: [() => clickText('New page'), () => typeLabel('Page name', 'Visiting')] }),
  'sb-new-nested': O({
    tab: 'pages',
    drive: [
      () => clickText('New page'),
      () => typeLabel('Page name', 'Winter Salon'),
      () => pickOption('Place under', 'Exhibitions'),
      () => clickText('Exhibition'),
    ],
  }),
  'sb-save-template': O({ tab: 'pages', drive: [() => clickText('List'), () => clickRow('After-Image'), () => clickText('Save as template'), () => typeLabel('Save After-Image', 'Exhibition, long run')] }),
  'sb-theme': O({ tab: 'theme' }),
  'sb-profile': O({ tab: 'profile' }),
  'sb-profile-nokinds': O({ tab: 'profile', can: { kinds: false } }),
  'sb-pages-plain': O({ tab: 'pages', plain: true, drive: [() => clickText('List'), () => clickRow('Artists')] }),
  'sb-popup-nonotes': O({ start: 'popup', can: { notes: false, savedTemplates: false } }),
  'sb-pages-nonotes': O({ tab: 'pages', can: { notes: false, savedTemplates: false }, drive: [() => clickText('List'), () => clickRow('After-Image')] }),
  'sb-card-noeditor': O({ start: 'card', noEditor: true }),
};

const raw = String((window as unknown as { __PAGE__?: string }).__PAGE__ ?? 'sb-card');
const name = raw.replace(/-phone$/, '');
const cfg = PAGES[name] ?? PAGES['sb-card'];

// ── stage: top bar + hub grid + the card's three states ───────────────────────────

const card = siteBuilderCard;

function TopBar({ org, me, role }: { org: { name: string; mark: string }; me: string; role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 52, padding: '0 28px', borderBottom: '1px solid var(--hc-divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
        <div style={{ width: 26, height: 26, border: '1px solid var(--hc-text)', display: 'grid', placeItems: 'center', fontFamily: 'var(--hc-font-heading)', fontWeight: 600, fontSize: 12 }}>{org.mark}</div>
        <span style={{ fontFamily: 'var(--hc-font-heading)', fontWeight: 600, fontSize: 18 }}>{org.name}</span>
        <span className="hc-overline">Hub</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="hc-avatar" style={{ width: 26, height: 26 }}>{initialsOf(me)}</div>
        <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 13 }}>{me}</div><div style={{ fontSize: 11, color: 'var(--hc-n-700)' }}>{role}</div></div>
      </div>
    </div>
  );
}

function Stage({ cfg }: { cfg: Cfg }) {
  const [view, setView] = React.useState<'hub' | 'popup' | 'detail'>(cfg.start === 'card' ? 'hub' : cfg.start);
  const [tab, setTab] = React.useState<string | null>(cfg.tab ?? null);
  const h = cfg.noEditor ? hostNoEditor : host;
  const can = { ...ALL_CAN, ...cfg.can };
  const data = React.useMemo(() => detail(cfg.org, can), []);

  const nav: HubNav = {
    view: view === 'hub' ? 'card' : view,
    tab,
    openPopup: () => setView('popup'),
    close: () => setView('hub'),
    openDetail: (t) => {
      setTab(t ?? null);
      setView('detail');
    },
  };

  React.useEffect(() => {
    cfg.drive?.forEach((step, i) => window.setTimeout(step, 500 + i * 350));
  }, []);

  const bare = cfg.start === 'card';
  const me = cfg.org === 'ifac' ? 'Mara Okafor' : 'Ruth Ellery';
  return (
    <div style={{ position: 'relative', minHeight: bare ? 0 : 900, background: 'var(--hc-bg)', overflow: 'hidden' }}>
      {bare ? null : <TopBar org={data.org} me={me} role="Owner" />}
      {view === 'detail' ? (
        <card.Detail data={data} host={h} nav={nav} />
      ) : (
        <div style={{ padding: 28 }}>
          {bare ? null : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 42 }}>Hub</h2>
              <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>Back office for {data.org.name}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 384px)', gap: 24, alignItems: 'start' }}>
            <card.Face data={data} host={h} nav={nav} />
            {bare ? null : [1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 372, border: '1px dashed var(--hc-n-300)', display: 'flex', alignItems: 'flex-end', padding: 14, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hc-n-500)' }}>Other hub card</div>
            ))}
          </div>
          {view === 'popup' ? <card.Popup data={data} host={h} nav={nav} /> : null}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <HubRoot theme={cfg.plain ? null : 'industry'} vars={cfg.plain ? PLAIN_VARS : undefined} icons={lucideHubIcons}>
    <Stage cfg={cfg} />
  </HubRoot>,
);
