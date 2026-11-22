import type { Area, Capability, Host, HostKey } from '../types';

// Site style on two more sites, the site menu on two sites, and one katie cart clean-up. 2026-11-21, closeout curator (added).
// All of these were in the inventory but claimed nowhere. Read: apps/{art-auction,innergathering}/src/lib/site-style-actions.ts and
// site-style.ts, apps/{sunjay,katie-the-potter}/src/lib/puck/nav-actions.ts, apps/katie-the-potter/src/lib/shop.ts and
// app/api/checkout/return/route.ts.

const V = '2026-11-21 read the site-style-actions.ts and site-style.ts of art-auction and innergathering, both nav-actions.ts, katie shop.ts dropPaidOrderFromCart';
const k = (kind: 'sa' | 'sql', path: string, fn: string): HostKey => `${kind}:apps/${path}#${fn}` as HostKey;
const host = (key: HostKey, app: string, path: string, how: string, service: string[], note?: string): Host => ({ key, service, address: { app, path, how }, ...(note ? { note } : {}) });
const twin = (key: HostKey, of: HostKey, app: string): Host => ({ key, service: ['@elkdonis/services#saveSiteTheme', '@elkdonis/direct-edit/site#cleanSiteStyle', '@elkdonis/db#withOrg'], address: { app, path: '/', how: 'sql twin: saveSiteStyle in lib/site-style.ts' }, note: `sql twin of ${of}; raw INSERT/DELETE on site_config key site-style:chrome, plus saveSiteTheme` });

const STYLE_CONFIRM = { text: "Change the site's look (colours, fonts, header and footer) on {org}? Visitors see it on every page at once.", status: 'draft' as const };

const capabilities: Capability[] = [
  {
    id: 'art-auction-site-style-save',
    area: 'orgapps.site-style',
    label: "Change the marketplace's look (colours, fonts, header and footer)",
    does: "Saves the marketplace site's theme values (site_themes, org `market`) and the header/footer look (site_config 'site-style:chrome'), each cleaned against the app's SITE_STYLE schema.",
    class: 'person',
    actors: ['admin', 'owner', 'guide'],
    scope: 'org',
    hosts: [
      host(k('sa', 'art-auction/src/lib/site-style-actions.ts', 'saveSiteStyleAction'), 'art-auction', '/', 'the Site style button (components/site-style/SiteStyleButton.tsx)', ['getPagesEditor (platform admin, or owner or guide of the marketplace org)', '(calls local saveSiteStyle)'], 'revalidates the root layout'),
      twin(k('sql', 'art-auction/src/lib/site-style.ts', 'saveSiteStyle'), k('sa', 'art-auction/src/lib/site-style-actions.ts', 'saveSiteStyleAction'), 'art-auction'),
    ],
    entry: null,
    status: "site_themes for the marketplace org and site_config site-style:chrome hold the cleaned values (loadSiteStyle)",
    risk: ['public'],
    confirm: STYLE_CONFIRM,
    inputs: 'style (theme values, header and footer looks)',
    drift: 'Same shape as site-style-save (sunjay, elktours, katie-the-potter) with a different gate: getPagesEditor (platform admin, or owner or guide of the marketplace org) instead of getApiEditor.',
    canonical: 'site-style-save',
    open: "The refusal text says \"owners and editors\" while the gate is owner or guide (or a platform admin): one of them is wrong. Nothing is stored yet (checked by the author on 2026-11-20): until the first save, no extra style is drawn.",
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'innergathering-site-style-save',
    area: 'orgapps.site-style',
    label: "Change the site's look (colours, fonts, header and footer)",
    does: "Saves the site's theme values (site_themes, org `inner_group`) and the header/footer look (site_config 'site-style:chrome'), each cleaned against the app's SITE_STYLE schema.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(k('sa', 'innergathering/src/lib/site-style-actions.ts', 'saveSiteStyleAction'), 'innergathering', '/', 'the Site style button (components/site-style/SiteStyleButton.tsx)', ['getApiEditor (signed in and canEdit = owner or guide)', '(calls local saveSiteStyle)'], 'revalidates the root layout'),
      twin(k('sql', 'innergathering/src/lib/site-style.ts', 'saveSiteStyle'), k('sa', 'innergathering/src/lib/site-style-actions.ts', 'saveSiteStyleAction'), 'innergathering'),
    ],
    entry: null,
    status: "site_themes for the org and site_config site-style:chrome hold the cleaned values (loadSiteStyle)",
    risk: ['public'],
    confirm: STYLE_CONFIRM,
    inputs: 'style (theme values, header and footer looks)',
    drift: 'None beyond the app: the same as site-style-save (sunjay, elktours, katie-the-potter), which has the same gate.',
    canonical: 'site-style-save',
    open: 'Nothing stored yet (the org has neither row as of 2026-11-20).',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'site-menu-save',
    area: 'orgapps.site-style',
    label: 'Edit the site menu',
    does: 'Saves the main navigation for the site (the shared saveSiteNav: a cap on the items, https or /path links only). The menu is drawn by the root layout, so every route is revalidated.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(k('sa', 'sunjay/src/lib/puck/nav-actions.ts', 'saveNavAction'), 'sunjay', '/studio/{slug}', "the Menu tab of the page editor (lib/puck editor, menuPlugin)", ['getApiEditor (signed in and canEdit = owner or guide)', '@elkdonis/services#saveSiteNav']),
      host(k('sa', 'katie-the-potter/src/lib/puck/nav-actions.ts', 'saveNavAction'), 'katie-the-potter', '/studio/{slug}', 'the Menu tab of the page editor (components/studio/menu-plugin.ts)', ['getApiEditor (signed in and canEdit = owner or guide)', '@elkdonis/services#saveSiteNav']),
    ],
    entry: null,
    status: 'the site menu for the org holds the cleaned items (loadNav)',
    risk: ['public'],
    confirm: { text: 'Save this menu on {org}? Visitors see it on every page at once.', status: 'draft' },
    inputs: 'items [{ label, href, sub }]',
    drift: "Two identical copies over one shared writer. danamccool's dana-navigation-save is the third, with its own store.",
    canonical: 'a shared site menu action (saveSiteNav is already the writer)',
    open: 'GOOD: the role check is in the action. The refusal text says "the site\'s editors" and the gate is canEdit (owner or guide), so they agree (unlike dana-navigation-save).',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'katie-cart-drop-paid',
    area: 'apps.katie-the-potter.site',
    label: "Take a paid order's pieces out of the buyer's cart",
    does: "After a confirmed payment, deletes the cart lines of this visitor's own cart that match the pieces of the paid order (matched by variant, within the visitor's own cart token). It never throws.",
    class: 'internal',
    actors: ['visitor'],
    scope: 'other',
    hosts: [
      { key: k('sql', 'katie-the-potter/src/lib/shop.ts', 'dropPaidOrderFromCart'), service: ['raw DELETE cart_line (USING cart, commerce_order_line)'], note: 'called from app/api/checkout/return/route.ts after the order is paid, fulfilled or completed; not an endpoint itself' },
    ],
    status: "no cart_line of the visitor's cart matches a variant of the paid order",
    risk: ['none'],
    drift: 'None: single copy.',
    open: 'Scoped by the visitor\'s own cart token and an order id (UUID checked); an order id alone cannot delete another visitor\'s lines. Added 2026-11-17 with the "no reserving while unpaid" change; claimed here because it had no row.',
    verified: V,
    added: '2026-11-21',
  },
];

const ignored: Area['ignored'] = [
  { key: k('sa', 'sunjay/src/lib/puck/nav-actions.ts', 'loadNavForEditor'), why: 'read exposed as a server action: the menu and the pages that could join it, for the Menu tab (editors only)' },
  { key: k('sa', 'katie-the-potter/src/lib/puck/nav-actions.ts', 'loadNavForEditor'), why: 'read exposed as a server action: the menu and the pages that could join it, for the Menu tab (editors only)' },
];

const area: Area = { capabilities, ignored };
export default area;
