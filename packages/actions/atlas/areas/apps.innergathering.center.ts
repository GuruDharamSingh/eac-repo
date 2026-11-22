import type { Area, Capability, Host, HostKey } from '../types';

// innergathering, the person's /center: sign-up, profile, photo, where you show, posting, follow, the center layout,
// portfolio and social connections. 2026-11-16, round 2 (curator ig). Most routes are near-copies of the
// arts-collective network-hub routes (same services, a different session helper), so each row names its twin in `drift`
// and carries the SAME `canonical`. Conventions: atlas/JOURNAL.md. The hub email/meeting/pipeline routes are in
// apps.innergathering.hub.ts, RSVP/workshop/contact in apps.innergathering.gatherings.ts, OIDC/pulse/forum in .system.ts.

const APP = 'innergathering';
const SRC = 'apps/innergathering/src/';
const V =
  '2026-11-16 read app/api/{auth/signup,center/*}/route.ts, lib/auth.ts; diffed against apps/arts-collective copies; callers in packages/cms-ui/src/hub/connectors.ts, HubSurfaces.tsx, components/login-form.tsx';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({
  key,
  service,
  address: { app: APP, path, how },
  note,
});

const CONNECTORS = 'packages/cms-ui/src/hub/connectors.ts';

const capabilities: Capability[] = [
  {
    id: 'ig-portfolio-save',
    area: 'innergathering.center',
    label: 'Choose a portfolio for this site',
    does: 'A person picks the images that make up their portfolio on this site (org_profiles.portfolio). The factory sitePortfolioRoutes checks the person or a global admin.',
    class: 'person',
    actors: [
      "person",
      "admin",
      "member",
      "guide",
      "owner"
    ],
    scope: 'person',
    hosts: [
      host(api('center/portfolio', 'PUT'), ['@elkdonis/services#sitePortfolioRoutes'], '/about/{slug}', 'SitePortfolioEditor on the person page (packages/cms-ui/src/gallery/SitePortfolioEditor.tsx, mounted in app/about/[slug]/page.tsx)'),
      {
        "key": "api:apps/sunjay/src/app/api/center/portfolio/route.ts#PUT",
        "service": [
          "@elkdonis/services#sitePortfolioRoutes"
        ],
        "address": {
          "app": "sunjay",
          "path": "/about/{slug}",
          "how": "the SitePortfolioEditor on the person page (packages/cms-ui/src/gallery/SitePortfolioEditor.tsx, mounted by app/about/[slug]/page.tsx)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/portfolio/route.ts#PUT",
        "service": [
          "(sitePortfolioRoutes: canEditProfile(viewer, person) = self or global admin)",
          "@elkdonis/services#setOrgPortfolio"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/",
          "how": "picture picker in the records block (blocks/records.tsx)"
        }
      },
    ],
    entry: null,
    status: 'org_profiles.portfolio for the person on inner_group lists the chosen images',
    risk: ['public'],
    confirm: {
      text: 'Save these {count} images as your portfolio on {org}? Visitors to your page there see them.',
      status: 'draft',
      wave: 6,
    },
    drift: "The route is a 4-line mount of the shared factory; hidden-enneagram and sunjay have the same route file (curated by other agents, not diffed).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (innergathering, sunjay, hidden-enneagram). Differences by app:\n- sunjay (was sunjay-portfolio-save): No amrit-canada copy (amrit has no portfolio route). ifac and artdirect save a gallery through profile-editor actions (orgapps.editing:profile-portfolio-save), a different path to the same data idea.\n- hidden-enneagram (was he-portfolio-choose): Shared packages/services sitePortfolioRoutes mount; URLs must be in the person's own /api/media folder, their home list or the current site list (good).",
    canonical: 'services sitePortfolioRoutes (already shared); mount only',
    verified: V,
    open: "sunjay (sunjay-portfolio-save): Service factory checks the person or a global admin (route comment); not re-read here.",
    inputs: "person (slug), items [{ url, title, x, y, w, h }]",
  },
  {
    id: 'ig-portfolio-upload',
    area: 'innergathering.center',
    label: 'Upload a portfolio image',
    does: 'Uploads an image into the person’s own folder from the portfolio editor, so it can be picked for the portfolio.',
    class: "person",
    actors: [
      "person",
      "admin",
      "member",
      "guide",
      "owner"
    ],
    scope: 'person',
    hosts: [
      host(api('center/portfolio', 'POST'), ['@elkdonis/services#sitePortfolioRoutes'], '/about/{slug}', 'the upload button in SitePortfolioEditor.tsx'),
      {
        "key": "api:apps/sunjay/src/app/api/center/portfolio/route.ts#POST",
        "service": [
          "@elkdonis/services#sitePortfolioRoutes"
        ]
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/portfolio/route.ts#POST",
        "service": [
          "(sitePortfolioRoutes: canEditProfile = self or global admin)",
          "@elkdonis/utils#validateUploadBuffer",
          "@elkdonis/services#uploadUserFile"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/",
          "how": "Upload in the records block picker (blocks/records.tsx)"
        }
      },
    ],
    status: 'a file under the person’s own Nextcloud tree',
    risk: ['none'],
    drift: "shared factory mount; see ig-portfolio-save.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (innergathering, sunjay, hidden-enneagram). Differences by app:\n- sunjay (was sunjay-portfolio-upload): Same factory handler as the PUT; step inside portfolio-save.\n- hidden-enneagram (was he-portfolio-upload): Shared sitePortfolioRoutes POST; unlike ifac center/avatar it sniffs bytes (validateUploadBuffer).",
    canonical: 'services sitePortfolioRoutes (already shared); mount only',
    open: 'Upload type and size checks live inside the factory (services/site-portfolio.ts); not read here.',
    verified: V,
    confirm: {
      "text": "Upload “{file}” to your library? It is not shown on your page until you choose it.",
      "status": "draft",
      "wave": 6
    },
    inputs: "person (slug), file",
  },
];

const ignored: Area["ignored"] = [];

const area: Area = { capabilities, ignored };
export default area;
