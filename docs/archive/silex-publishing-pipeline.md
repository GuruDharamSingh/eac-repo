# Silex → Nextcloud → React: the site-publishing pipeline

How a non-technical owner edits a visual site (GrapeJS/Silex), how it gets
stored & published (Nextcloud), and how a Next.js app serves it back with live
React islands. This is the system behind `apps/arts-collective` and the
dedicated `apps/hidden-enneagram` site (`hiddenenneagram.com`).

---

## The big picture

There are three layers. Each is independently useful; together they let someone
edit a site by dragging blocks while we still get full React power around it.

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 1. CONTENT (visual, owner-edited)                                    │
  │    GrapeJS blocks in the Silex editor (:6805)                        │
  │      → saved as website.json in the owner's Nextcloud                │
  │      → "Publish" writes static .html/.css into Nextcloud/…/published │
  └─────────────────────────────────────────────────────────────────────┘
                                  │  static HTML/CSS over WebDAV
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 2. RENDER (shared) — @elkdonis/silex-render                          │
  │    fetch published HTML → sanitize → rewrite asset URLs →            │
  │    bind live DB values into data-trait slots →                      │
  │    swap <eac-embed> placeholders for live React                     │
  └─────────────────────────────────────────────────────────────────────┘
                                  │  React tree
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 3. APP (per-site Next.js)  e.g. apps/hidden-enneagram (:3012)        │
  │    "/" and "/[page]" render the published pages                     │
  │    + auth (login/signup/account/admin), inquiry form, asset proxy   │
  └─────────────────────────────────────────────────────────────────────┘
```

The key idea: **the static HTML is just a skeleton.** Anywhere the owner drops a
"live" block, the published HTML contains a placeholder tag
(`<eac-embed data-eac-component="…">`); at request time the React app replaces
that placeholder with a real server/client component (a booking list, an RSVP
panel, a contact form). Plain text/layout blocks pass straight through.

---

## The pieces

### GrapeJS + Silex (the editor)
- **GrapeJS** is the open-source block-based web editor (drag/drop, style panel,
  component tree). **Silex** is a thin app/server around GrapeJS that adds
  storage, publishing, and a plugin system.
- Runs as its own container (`silex`, port **6805**), image `silexlabs/silex`.
- We extend it with one plugin: **`@elkdonis/silex-nextcloud-connector`**
  (bind-mounted into the container, no build step — plain JS).

### The connector — `packages/silex-nextcloud-connector/`
This is where our blocks/templates live and where Silex is wired to Nextcloud.

- **Editor blocks & templates** (browser side, `src/client-config.js`, served at
  `/silex.js`): registers GrapeJS component types + Block Manager entries.
  Categories: EAC Layout/Content, Live Slots, and per-template categories
  (Workshop, Dossier, **Enneagram**).
- **Templates** live under `src/templates/<id>/`:
  - `manifest.json` — section list (`sections[]`) + page compositions (`pages[]`),
    `cssOrder`, and the `tokens` file.
  - `html/eac-*.html` — each block's markup (`data-gjs-type`, `data-trait`,
    `data-href-trait` hooks).
  - `css/eac-*.css` + `tokens/…css` — namespaced styles (`.eac-enn-*`, etc.).
  - The connector serves these to the editor at `/eac-<id>.json` and
    `/eac-<id>.css` (`src/editorAssetsMiddleware.js`).
- **Auth bridge** (`src/auth.js`): the arts-collective hub mints a one-time
  token; the connector exchanges it for the owner's per-user Nextcloud
  credentials and stashes them in the Silex session. So each editing session
  reads/writes only that owner's Nextcloud folder.
- **Storage connector** (`src/NextcloudStorage.js`): the project lives at
  `…/silex/project/website.json` (+ `meta.json`, `assets/`). This is the GrapeJS
  `ProjectData` (pages, styles, assets…).
- **Hosting connector** (`src/NextcloudHosting.js`): "Publish" writes the
  generated static files into `…/silex/published/` plus a `.eac-publish.json`
  manifest (records the entry HTML).

### Nextcloud (per-owner storage)
- Each owner has a Nextcloud account; their site's project **and** published
  output live in *their* folder, authenticated by *their* app password (stored
  on `users.nextcloud_app_password`). Nextcloud is the source of truth for
  site content; Postgres is the source of truth for live data (threads,
  workshops, RSVPs, contacts).

### The shared renderer — `packages/silex-render/`
Consumed as source (via `transpilePackages`) by every host app, so the
fetch→bind→embed logic exists once. Exports:
- `SilexSite({ org, cssLinks, page })` / `SilexSiteBySlug({ slug, page })` —
  the server component that renders a published page. Pipeline (`silex-site.tsx`):
  1. **download** the published HTML from Nextcloud (`published.ts` →
     `downloadPublishedFile`, keyed off `silex_published_path`);
  2. **sanitize** — strip HTML comments + `<script>`/inline handlers
     (`stripScripts`);
  3. **rewrite asset URLs** — `/css/…` and `/assets/…` → `/api/silex/assets/<slug>/…`
     so images/CSS resolve through the app's proxy;
  4. **bind live data** — if the HTML has `data-trait="…"` slots and the org has
     a published workshop, fill them from the DB (`@elkdonis/cms-bindings`
     `applyWorkshopTraits`);
  5. **mount live React** — `renderSilexHtmlWithEmbeds` (`embeds.tsx`) splits the
     HTML on `<eac-embed>` and swaps each for a live component (org feed,
     workshop cards, RSVP, poll, live room, resources, **inquiry form**).
- `InquiryForm` — the "use client" contact-form island (`inquiry-form.tsx`).
- `handleOrgContact(req, { slug })` — shared POST handler that logs a `contacts`
  row and emails the owner (`@elkdonis/email`).
- Read queries (`queries.ts`): `getOrgBySlug`, `getOrgFeed`,
  `getOrgWorkshopForTemplate`, `getCommunityFeed`.

### The host app — `apps/hidden-enneagram/`
A normal Next.js app (port **3012**, domain `hiddenenneagram.com`) that is mostly
a thin shell over the renderer plus its own auth.
- `src/app/page.tsx` → `<SilexSiteBySlug slug="hidden-enneagram" />` (the home /
  `index.html`).
- `src/app/[page]/page.tsx` → renders `<page>.html` (introduction, centers,
  triads, services, contact, type-1…9). An allow-list guards which pages exist.
- `src/app/api/silex/assets/[slug]/[...path]` → streams published assets
  (CSS/images) out of Nextcloud (the target of the asset-URL rewrite).
- `src/app/api/silex/templates/enneagram.css` → serves the combined template CSS
  (belt-and-suspenders; the published stylesheet also carries it).
- **Auth** (`@elkdonis/auth-client` + `@elkdonis/auth-server`, shared GoTrue):
  `/login` `/signup` `/account` `/admin`, and `/api/auth/{login,signup,logout,session}`.
  Signup is **org-scoped** — new accounts join only `hidden-enneagram`
  (`handleSignup(req, { defaultOrgs:[{id:'hidden-enneagram',role:'member'}] })`).
  Cookies are host-only (no `EAC_COOKIE_DOMAIN`), so the session is independent
  to his domain.
- `src/app/api/org/[slug]/contact` → `handleOrgContact` (the inquiry form posts
  here).

---

## Two lifecycles

### Editing (owner)
```
arts-collective hub  →  "Open editor"  →  mint one-time token
   →  redirect to Silex :6805/?slug=&t=
   →  connector redeems token → owner's Nextcloud creds in session
   →  owner drags EAC blocks, edits text/links
   →  Save  → website.json in Nextcloud
   →  Publish → static .html/.css in Nextcloud/…/published + .eac-publish.json
```

### Visiting (public)
```
GET hiddenenneagram.com/centers
   →  app [page] route → SilexSiteBySlug(slug, page="centers")
   →  org row gives silex_published_path (nextcloud://user/…/published/index.html)
   →  download …/published/centers.html  (owner's Nextcloud, cached 60s)
   →  sanitize → rewrite /css|/assets → bind data-trait → swap <eac-embed>
   →  React tree (static blocks + live islands) → HTML to the browser
   →  browser also loads /api/silex/assets/centers… (CSS) + the template CSS link
```

---

## How a site becomes "live" (provisioning)

The DB and Nextcloud both need to be set up once:
1. **Org row** in `organizations` (`slug`, `layout_mode='silex'`) + an owner in
   `user_organizations` (`role='owner'`).
2. **Nextcloud account** for the owner with an app password on the `users` row.
3. **Seed/Publish** — either the owner publishes from Silex, or run
   `packages/silex-nextcloud-connector/scripts/seed-enneagram-site.mjs`
   (composes the template pages, writes `website.json` + the published static
   files over WebDAV).
4. **Point the org at it** — set `organizations.silex_published_path` to the
   published entry ref (`nextcloud://<ncUser>/…/published/index.html`). The seed
   script prints the exact `UPDATE …` SQL.

Until step 4, `SilexSite` renders a "Custom layout coming soon" fallback (or, if
the org row doesn't exist at all, nothing — just the app chrome).

---

## Adding a new template (the pattern)

Mirror `templates/dossier-classified/` (the closest analog):
1. `src/templates/<id>/manifest.json` + `html/` + `css/` + `tokens/`.
2. Add reader fns in `src/workshopTemplateRegistry.js`, routes in
   `src/editorAssetsMiddleware.js` (push to `ASSET_ROUTES`), and register
   blocks/types/CSS in `src/client-config.js`.
3. (Optional) a public CSS route in the host app + a `cssLinks` entry.
4. `docker compose restart silex` (the connector is bind-mounted, no build).

Adding a new **site** = provision an org + (optionally) a thin app like
`apps/hidden-enneagram`, both consuming `@elkdonis/silex-render`.

---

## Gotchas we hit (and the fixes)

- **Container can't reach Nextcloud.** App containers must share a Docker network
  with `nextcloud-nginx`. The compose external net must map to **`nextcloud-network`**
  (not the stale `nextcloud-aio`). Symptom: WebDAV `fetch failed` / `nc ERR`.
- **`next/font/google` fails offline.** It downloads fonts at build time; the
  isolated container can't reach `fonts.gstatic.com`, which 500s the whole app
  (the layout error poisons every route). Fix: load fonts with a plain
  `<link>` in the layout `<head>` (browser-side), not `next/font`.
- **HTML comments containing `<eac-embed>` text.** Authored template comments
  like "the `<eac-embed>` is a live slot" get mis-parsed as a real embed and eat
  following markup. Fix: strip HTML comments before the embed pass (done in both
  `silex-render`'s sanitizer and the seed).
- **Placeholder links.** Template blocks ship `href="#"`; the seed rewrites the
  nav / TOC / type-grid to real page routes (`/introduction`, `/type-3`, …).
- **Bind-mount file watching.** Editing files on the host doesn't always trigger
  Turbopack to recompile inside the container; `docker compose restart <svc>`
  forces a clean rebuild.

---

## File map (quick reference)

| Concern | Path |
|---|---|
| Editor blocks/templates, Silex↔Nextcloud | `packages/silex-nextcloud-connector/` |
| Template definitions | `packages/silex-nextcloud-connector/src/templates/<id>/` |
| Seed a full site | `packages/silex-nextcloud-connector/scripts/seed-enneagram-site.mjs` |
| Shared renderer (fetch→bind→embeds) | `packages/silex-render/src/` |
| Live embed components | `packages/silex-render/src/embeds.tsx`, `inquiry-form.tsx` |
| CMS data binding | `packages/cms-bindings/` |
| Dedicated site app | `apps/hidden-enneagram/` |
| Original Silex host | `apps/arts-collective/` (`silex-layout.tsx` re-exports the renderer) |
