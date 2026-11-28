import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.site-style ----------------
  {
    id: 'site-style-save',
    where: {"mode": "dock", "why": "Colours and fonts."},
    area: 'orgapps.site-style',
    label: "Change the site's look (colours, fonts, header and footer)",
    does: "Saves the org site's theme values (site_themes) and the header/footer look (site_config 'site-style:chrome'), each cleaned against the app's SITE_STYLE schema.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/site-style-actions.ts#saveSiteStyleAction',
        service: ['(calls local saveSiteStyle)'],
        address: {
          app: 'sunjay',
          path: '/?edit (canvas editor Style panel)',
          how: 'Style panel in the direct-edit canvas',
        },
      },
      {
        key: 'sql:apps/sunjay/src/lib/site-style.ts#saveSiteStyle',
        service: [
          '@elkdonis/services#saveSiteTheme',
          '@elkdonis/direct-edit/site#cleanSiteStyle',
          '@elkdonis/db#withOrg',
        ],
        address: { app: 'sunjay', path: '/?edit', how: 'sql twin: saveSiteStyle in lib/site-style.ts' },
        note: 'raw INSERT/DELETE on site_config key site-style:chrome, plus saveSiteTheme',
      },
      {
        key: 'sa:apps/elktours/src/lib/site-style-actions.ts#saveSiteStyleAction',
        service: ['(calls local saveSiteStyle)'],
        address: {
          app: 'elktours',
          path: '/?edit (canvas editor Style panel)',
          how: 'Style panel in the direct-edit canvas',
        },
      },
      {
        key: 'sql:apps/elktours/src/lib/site-style.ts#saveSiteStyle',
        service: [
          '@elkdonis/services#saveSiteTheme',
          '@elkdonis/direct-edit/site#cleanSiteStyle',
          '@elkdonis/db#withOrg',
        ],
        address: { app: 'elktours', path: '/?edit', how: 'sql twin: saveSiteStyle in lib/site-style.ts' },
        note: 'raw INSERT/DELETE on site_config key site-style:chrome, plus saveSiteTheme',
      },
      {
        key: 'sa:apps/katie-the-potter/src/lib/site-style-actions.ts#saveSiteStyleAction',
        service: ['(calls local saveSiteStyle)'],
        address: {
          app: 'katie-the-potter',
          path: '/?edit (canvas editor Style panel)',
          how: 'Style panel in the direct-edit canvas',
        },
      },
      {
        key: 'sql:apps/katie-the-potter/src/lib/site-style.ts#saveSiteStyle',
        service: [
          '@elkdonis/services#saveSiteTheme',
          '@elkdonis/direct-edit/site#cleanSiteStyle',
          '@elkdonis/db#withOrg',
        ],
        address: { app: 'katie-the-potter', path: '/?edit', how: 'sql twin: saveSiteStyle in lib/site-style.ts' },
        note: 'raw INSERT/DELETE on site_config key site-style:chrome, plus saveSiteTheme',
      },
      {
        key: 'sa:apps/hidden-enneagram/src/lib/site-style-actions.ts#saveSiteStyleAction',
        service: ['(calls local saveSiteStyle)'],
        address: {
          app: 'hidden-enneagram',
          path: '/?edit (canvas editor Style panel)',
          how: 'Style panel in the direct-edit canvas',
        },
        note: 'also revalidates "/" layout',
      },
      {
        key: 'sql:apps/hidden-enneagram/src/lib/site-style.ts#saveSiteStyle',
        service: [
          '@elkdonis/services#saveSiteTheme',
          '@elkdonis/direct-edit/site#cleanSiteStyle',
          '@elkdonis/db#withOrg',
        ],
        address: { app: 'hidden-enneagram', path: '/?edit', how: 'sql twin: saveSiteStyle in lib/site-style.ts' },
        note: 'raw INSERT/DELETE on site_config key site-style:chrome, plus saveSiteTheme',
      },
    ],
    entry: null,
    status: "site_themes (org, page_key '') row and site_config site-style:chrome row hold the saved values",
    risk: ['public'],
    confirm: {
      text: 'Change the colours, fonts and header and footer of {org}’s site? Visitors see the new look.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'style {theme, chrome}',
    drift: "Four copies of the same pair of files. saveSiteStyleAction is byte-identical in sunjay, elktours, katie-the-potter (md5 f2092db3/607303ab family: getApiEditor then saveSiteStyle, NO revalidatePath in sunjay and elktours (katie revalidates, like HE; corrected 2026-11-16 by lane siteform), so the public site may show the old style until a cache expiry). hidden-enneagram adds revalidatePath('/', 'layout') and its error text says 'owners and editors' (actually owner/guide, same getApiEditor). site-style.ts differs only in comments (sunjay/elktours/katie/HE). Each app has its own site-style-schema.ts (62-86 lines) that differs, so allowed values are per-app. All gates are getApiEditor (owner/guide); the raw SQL for site_config is in the app, and services saveSiteTheme itself has NO role check (caller must), same for the theme family below. Arts-collective equivalent: see apps/arts-collective keys.",
    canonical: "One org-site kit action: getApiEditor + services saveSiteTheme + a services saveSiteChrome (moves the raw site_config SQL out of apps) + revalidatePath('/', 'layout'); the SITE_STYLE schema stays per app as config.",
    open: 'sunjay and elktours do not revalidate after saving a style: should they (katie and HE do)? Cheap fix at canonical merge.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,hidden-enneagram}/src/lib/site-style{,-actions}.ts; ifac/src/lib/theme-actions.ts; danamccool/src/lib/theme-actions.ts; sunjay/src/lib/banner-actions.ts; services themes.ts saveSiteTheme',
  },
  {
    id: 'site-theme-save',
    where: {"mode": "dock", "why": "Colours and fonts."},
    area: 'orgapps.site-style',
    label: "Change the site's theme (palette and fonts)",
    does: "Saves an org site's palette and fonts: ifac as per-page theme vars in site_themes, danamccool as palette/fonts through its own store.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/theme-actions.ts#saveIfacThemeAction',
        service: ['@elkdonis/services#hasOrgRole', '@elkdonis/services#saveSiteTheme'],
        address: { app: 'ifac', path: '/manage/theme', how: 'theme editor Save' },
        note: 'explicit hasOrgRole owner|guide; revalidates / layout',
      },
      {
        key: 'sa:apps/danamccool/src/lib/theme-actions.ts#savePaletteAction',
        service: ['(local savePalette)'],
        address: { app: 'danamccool', path: '/manage', how: 'Puck Theme tab, colours' },
      },
      {
        key: 'sa:apps/danamccool/src/lib/theme-actions.ts#saveFontsAction',
        service: ['(local saveFonts)'],
        address: { app: 'danamccool', path: '/manage', how: 'Puck Theme tab, fonts' },
      },
      {
        key: 'sa:apps/danamccool/src/lib/theme-actions.ts#saveThemeAction',
        service: ['(local savePalette + saveFonts)'],
        address: { app: 'danamccool', path: '/manage', how: 'Puck Theme tab, Save both' },
      },
      {
        key: 'sql:apps/danamccool/src/lib/theme-store.ts#savePalette',
        service: ['@elkdonis/db#db'],
        address: { app: 'danamccool', path: '/manage', how: 'theme-store.ts' },
        note: 'raw SQL',
      },
      {
        key: 'sql:apps/danamccool/src/lib/theme-store.ts#saveFonts',
        service: ['@elkdonis/db#db'],
        address: { app: 'danamccool', path: '/manage', how: 'theme-store.ts' },
        note: 'raw SQL',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/theme-actions.ts#saveSiteThemeAction",
        "service": [
          "saveSiteTheme",
          "hasOrgRole"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization?org={org}",
          "anchor": "site-theme-save",
          "how": "Settings > Appearance, the CssPanel save (components/hub/AppearancePanel.tsx)."
        }
      },
    ],
    entry: null,
    status: 'site_themes (or danamccool theme store) row has the saved palette/fonts',
    risk: ['public'],
    confirm: { text: 'Change the {name} of {org}’s site? Visitors see the new look.', status: 'draft', wave: 3 },
    inputs: 'pageKey, vars | palette, fonts',
    drift: "Two incompatible stores. ifac uses services saveSiteTheme (site_themes, per page_key) with a hasOrgRole owner|guide check it does itself (via getServerSession). danamccool bypasses services entirely: raw SQL in lib/theme-store.ts, gate viewer.canEdit (owner|guide); its error texts say 'Only the site owner' for colours but the gate is canEdit (owner or guide). Both revalidate '/' layout. The four site-style apps use yet another path (site-style-save). Three theme paths to one concept.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was save-site-theme): no drift recorded",
    canonical: 'site_themes via services saveSiteTheme (the site-style-save path); danamccool migrates its palette/fonts into site_themes vars.',
    open: "danamccool's theme data lives outside site_themes: migrating needs a data move (not done here). Fonts/palette parity with the site-style schema to be decided.\narts-collective (save-site-theme): Hub entry site-theme-exception-remove (delete a page exception) has no host in this app.",
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,hidden-enneagram}/src/lib/site-style{,-actions}.ts; ifac/src/lib/theme-actions.ts; danamccool/src/lib/theme-actions.ts; sunjay/src/lib/banner-actions.ts; services themes.ts saveSiteTheme',
  },
  {
    id: 'user-theme-save',
    where: {"mode": "dock", "why": "A few colour and font choices."},
    area: 'orgapps.site-style',
    label: 'Change my own profile look',
    does: "Saves the signed-in person's own theme for their profile pages; identity is theirs, no org role consulted.",
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/theme-actions.ts#saveMyIfacThemeAction',
        service: ['@elkdonis/services#saveUserTheme'],
        address: { app: 'ifac', path: '/account', how: 'my theme editor Save' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/theme-actions.ts#saveMyThemeAction",
        "service": [
          "saveUserTheme"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization",
          "anchor": "user-theme-save",
          "how": "My appearance panel (components/hub/MyAppearancePanel.tsx) on the Organization tab."
        }
      },
    ],
    entry: null,
    status: 'users theme row holds the saved vars',
    risk: ['public'],
    confirm: { text: 'Change the look of your own page? Visitors to your page see it.', status: 'draft', wave: 3 },
    inputs: 'vars',
    drift: "Single copy (ifac). Revalidates / layout of the ifac site for a per-person change.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was save-my-theme): no drift recorded",
    canonical: 'services saveUserTheme via the kit.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,hidden-enneagram}/src/lib/site-style{,-actions}.ts; ifac/src/lib/theme-actions.ts; danamccool/src/lib/theme-actions.ts; sunjay/src/lib/banner-actions.ts; services themes.ts saveSiteTheme',
  },
  {
    id: 'site-banner-save',
    where: {"mode": "dock", "why": "One picture, alt text and a Save button."},
    area: 'orgapps.site-style',
    label: 'Change the landing banner',
    does: 'Sets or removes the landing banner picture (site_config image_spaces.hero) with alt text and framing.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/banner-actions.ts#saveBanner',
        service: ['@elkdonis/db#withOrg'],
        address: { app: 'sunjay', path: '/', how: 'banner edit on the landing hero (direct edit)' },
        note: 'raw INSERT in the action',
      },
      {
        key: 'sql:apps/sunjay/src/lib/banner-actions.ts#saveBanner',
        service: ['@elkdonis/db#withOrg'],
        address: { app: 'sunjay', path: '/', how: 'sql twin' },
      },
    ],
    entry: null,
    status: 'site_config image_spaces.hero path is the chosen picture',
    risk: ['public'],
    confirm: {
      text: 'Change {org}’s landing banner to the picture shown? Visitors see it at the top of the home page.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'url, alt, frame',
    drift: "Only sunjay has this action in the org apps (other apps' hero lives in Puck/direct-edit blocks). Validates url starts /api/media/ or https:// and rejects Private/ paths. Raw SQL in the action.",
    canonical: 'A services saveSiteImageSpace (the validation and SQL move into services); one kit action.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,hidden-enneagram}/src/lib/site-style{,-actions}.ts; ifac/src/lib/theme-actions.ts; danamccool/src/lib/theme-actions.ts; sunjay/src/lib/banner-actions.ts; services themes.ts saveSiteTheme',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/danamccool/src/lib/theme-actions.ts#loadThemeForEditor', why: 'read: loads the theme editor data' },
];

export default { capabilities, ignored } satisfies Area;
