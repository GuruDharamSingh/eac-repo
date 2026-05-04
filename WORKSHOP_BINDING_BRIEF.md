# Workshop CMS Binding — Architecture Brief

**Author:** session handoff to 1M-context analysis agent
**Date:** April 27, 2026
**Status:** Pre-implementation. DB schema is live (migration 038). Template HTML, manifest, server actions, and hub form scaffolding exist but are not yet connected.

---

## 1. The Gap (what this brief is about)

The workshop template HTML files (`packages/silex-nextcloud-connector/src/templates/workshop/html/eac-ws-*.html`) carry `data-trait="title"`, `data-trait="startDate"`, etc. These trait names exist for two reasons:

1. They surface in the Silex traits panel so an editor can manually type values.
2. They are documented in `manifest.json` under each section's `cmsFields` array, mapped to canonical DB columns like `threads.title` or `workshop_pages.session_count`.

**Nothing reads or writes the bridge between those two facts.** The DB has data (migration 038 added `workshop_pages` sidecar). The HTML has placeholder text. The manifest documents the mapping. **No code consumes the manifest to bind DB rows to template HTML in either direction.**

The only live-data mechanism today is the `<eac-embed>` slot system in [`apps/arts-collective/src/components/silex-embeds.tsx`](apps/arts-collective/src/components/silex-embeds.tsx) — which is a *slot* mechanism for whole UI panels (feed, RSVP, workshops list), **not** a *field-binding* mechanism for individual data points inside a template.

A workshop opened in Silex today shows hard-coded placeholder text ("Writing as a Practice, Not a Product"). A workshop "published" via Silex stores those placeholders verbatim into Nextcloud, and [`apps/arts-collective/src/components/silex-layout.tsx`](apps/arts-collective/src/components/silex-layout.tsx) inlines the HTML into the public org page with no field hydration.

**This brief asks: design the binding layer that closes the gap, and design the editing surfaces that consume it.**

---

## 2. Current State Snapshot

### What exists and works

| Layer | Location | State |
|---|---|---|
| DB schema | `packages/db/migrations/038_workshop_pages.sql` | Live. `threads.format` enum + `workshop_pages` sidecar table with all fields documented inline. |
| Zod schemas | [`apps/arts-collective/src/lib/cms/schema.ts`](apps/arts-collective/src/lib/cms/schema.ts) | `workshopPageSchema` covers all sidecar fields. |
| Server action | [`apps/arts-collective/src/lib/cms/actions.ts`](apps/arts-collective/src/lib/cms/actions.ts) | `upsertWorkshopPageAction` — INSERT … ON CONFLICT, auth-checked, revalidates. |
| Template HTML | `packages/silex-nextcloud-connector/src/templates/workshop/html/eac-ws-*.html` | 10 sections with `data-trait` and `data-gjs-type` attributes. Placeholder content. |
| Template manifest | `packages/silex-nextcloud-connector/src/templates/workshop/manifest.json` | `cmsFields` use canonical `table.column` notation. Documentation only — no consumer. |
| Schema doc | `packages/silex-nextcloud-connector/src/templates/workshop/cms/workshop.schema.md` | Authoritative trait↔column map. Hand-maintained. |
| Silex registration | `packages/silex-nextcloud-connector/src/client-config.js` | Workshop sections register as GrapesJS component types with traits. |
| Embeds (slot system) | [`apps/arts-collective/src/components/silex-embeds.tsx`](apps/arts-collective/src/components/silex-embeds.tsx) | `renderSilexHtmlWithEmbeds` rewrites `<eac-embed kind="feed">` → React. Field-level binding NOT covered here. |
| Public org render | [`apps/arts-collective/src/components/silex-layout.tsx`](apps/arts-collective/src/components/silex-layout.tsx) | Downloads published HTML from Nextcloud, strips scripts, inlines via `dangerouslySetInnerHTML`, applies embed substitution. No field hydration step. |
| Org routing | [`apps/arts-collective/src/app/sites/[slug]/page.tsx`](apps/arts-collective/src/app/sites/[slug]/page.tsx) | Subdomain → org. Renders Silex layout if `org.layout_mode === "silex"` and `silex_published_path` set, else default React layout. |
| Stale preview | [`apps/arts-collective/src/app/preview/workshop/page.tsx`](apps/arts-collective/src/app/preview/workshop/page.tsx) | Reads `Example.Ref.GrapeJSBlocks/BLOCKTEMPLAtaeworkshop` — wrong path. Should repoint to canonical template tree. |

### What does NOT exist

- Any code that **reads** `workshop_pages` + `threads` and **writes** values into the template HTML at render time.
- Any code that **opens** a workshop in Silex and **pre-fills** trait values from the DB.
- A per-workshop public URL. `/sites/[slug]` only renders the whole-org page; individual workshops are not deep-linkable.
- Hub workshop CMS form (planned in `HANDOFF.md` — `/hub/workshops/[orgSlug]/[threadId]`).
- Subdomain owner-edit affordance (edit-mode toggle, attendee-change notification prompt).
- Slug column on `threads` for pretty URLs.
- Generic binder package consumable by both Next.js (SSR) and Silex client-config (editor pre-fill).
- SSO between main domain ↔ subdomain ↔ Nextcloud subdomain. Currently three separate auth contexts; users must log in repeatedly. Out of scope for this brief but mentioned because it shapes the member journey.

---

## 3. Design Principles (from product owner)

These are the constraints the binding layer must respect.

### 3.1 Polycentric editing, single DB

Three write surfaces, all hitting the same Postgres tables:

- **Hub form** (`/hub/workshops/[org]/[id]`) — primary headless-CMS form for org owners. Best for structured editing of all sidecar fields.
- **Subdomain inline editor** — owner signed in on their subdomain sees an edit-mode toggle. Limited fields: title, body, date, location, registration_status. Member-permissioned variants later (members posting to feed).
- **Silex** — layout/style + occasional content tweaks. Rare path.

The DB is the source of truth for all field values. Published HTML owns layout + locked decorative copy only.

### 3.2 Bidirectional binding

- **Editor pre-fill**: when a workshop opens in Silex, traits are populated from the DB.
- **Render-time injection**: when a published workshop is requested by a public visitor, Next.js fetches the DB and rewrites `data-cms`-attributed nodes server-side. DB edits show without re-publishing in Silex.

### 3.3 Shared template, no fork

There is **one** workshop template. All published workshops render against it with their own data. No "fork into custom Silex page" mechanism. Per-thread variation comes only from:

- `workshop_pages.optional_sections` JSONB (which sections appear)
- Trait values (DB-bound or static text)
- Org-level theme tokens (typography pair, palette, motion preset)

Rationale: keeps the surface minimal-maximalist — one canvas per kind, one set of templates per network, infinite data.

### 3.4 Per-thread public URLs

`acme.domain.com/[content-slug]` — slug-based, no `/workshops/` segment. Server dispatches by `thread.kind`. Add a `slug` column on `threads` with org-scoped uniqueness.

This means each subdomain has effectively **two routable surfaces**:

- `/` — org landing (Silex-published or default React layout)
- `/[slug]` — individual published thread (workshop, event, post) rendered through its kind's template

Two surfaces fits the minimalist-maximalist principle: one expressive landing flyer, one structural template re-rendered with data.

### 3.5 Optional sections omit at server

When a section is marked optional in the manifest AND its backing data is empty AND `optional_sections[sectionId]` is not explicitly `true`, the server drops the entire `<section>` from the rendered HTML. No display:none — no DOM presence at all.

### 3.6 No realtime layer

SSR + `revalidateTag` on writes. Websocket pub/sub is not justified by current usage. May revisit when collaborative editing or live RSVP counters appear.

### 3.7 Generic binder, workshop is first consumer

The binding system is designed once, generically. Workshop is the first content kind. Events, posts, announcements, and future kinds plug in by shipping their own template + manifest + (optional) computed-field module.

### 3.8 Computed fields live in shared TS

The product owner asked about Python for cross-monorepo logic. Recommendation in this brief: a shared TypeScript package (e.g. `packages/cms-bindings`) consumed by both Next.js SSR and Silex client-config. Same module, two contexts. Python would introduce a second runtime without payoff. The 1M agent should weigh in if there's a stronger argument either way.

### 3.9 Trust before convenience

When an owner edits attendee-affecting data (date, time, location, cancellation, registration_status flipping to `closed`), the editor surface must prompt them to send a notification email to confirmed attendees. This is a first-class UX requirement, not a future enhancement. Trust is the product.

---

## 4. Creative Direction

| Dimension | Decision |
|---|---|
| Visual voice | Single curated theme for now (sketch palette: gold + blue + white). Theme-presets architecture so 3–5 curated themes land later. Hub gets a distinct house style; subdomains carry the curated theme. |
| Transition flourish | Page-turn / bumper loader between `/sites/[slug]` and `/[slug]` workshop URL. Editorial signal that you've moved rooms. |
| Member journey | Progressive — same page deepens once signed in. Drawer/sidebar member UX deferred; the per-workshop URL is the concept space where richer member surfaces will incubate. |
| Density | Commerce-first today (logistics above the fold). Per-kind adaptive density is the destination. |
| First impression | Logistics-first on workshop pages. Visitor sees what/when/where/$ in 3 seconds. |
| Network framing | Main domain = onboarding portal for org/page creators. Subdomain = artist's flyer / front door. Long-term: artists graduate to their own domain while remaining in the monorepo network. External-artist directory is a small footer link, not a primary surface. |
| Owner edit affordance | Edit-mode toggle on the page (per §3.1 subdomain inline editor). Field-level inline editing in toggle mode. Attendee-change prompt per §3.9. |

---

## 5. Open Architecture Decisions for the 1M Agent

The product owner has leanings but wants a code-context-informed recommendation on each.

### 5.1 Where does field binding live in the HTML?

- **Option A**: `data-cms="threads.title"` on every bindable element. Renderer queries by attribute. Manifest validates pairing. Templates self-describe their bindings.
- **Option B**: Keep only `data-trait`. Manifest is the single source of trait→column mapping. Renderer reads manifest, builds a trait→column index, queries DOM by `data-trait`.
- **Option C**: Selector-based — manifest declares CSS-selector → column mappings. No HTML attributes for binding.

Owner leaning: A. Concern: don't want a "central manifest god-file."

### 5.2 Manifest scope

- **Option 1**: Manifest is the spec for everything per kind — bindings, computed fields, permissions, optional sections, repeatable shapes, validation.
- **Option 2**: Manifest = structure only. All behavior in TS code in the shared package.
- **Option 3** (recommended in this brief): Split — `manifest.json` for declarative structure + sibling `manifest.ts` for typed behavior (computed-field functions, permission predicates, validation).

Owner leaning: 3.

### 5.3 Manifest as build artifact?

If 5.1 = A, the question becomes: is `manifest.json` hand-edited or generated from `data-cms` attrs in CI? If generated, template authors only think about `data-cms`; manifest stays in sync automatically.

The 1M agent should choose. The deeper question is whether `manifest.json` belongs in version control as a source file or as a derived artifact.

### 5.4 Per-thread URL slug strategy

- Add `threads.slug` column with org-scoped uniqueness.
- Auto-generate from title; allow manual override; collision suffix only when needed.
- Decide: where does the lookup happen? A new route `apps/arts-collective/src/app/sites/[slug]/[contentSlug]/page.tsx`? Or middleware-level rewrite from `acme.domain.com/foo` → internal `/sites/acme/foo`?

### 5.5 Render-time binding mechanism

Two mechanisms have been proposed in past sessions:

- **Server-side string rewrite** — parse the template HTML once, traverse, replace nodes with `data-cms` matches by string substitution. Cheap, fits the existing `silex-layout.tsx` pattern.
- **Server-side React tree** — parse template HTML to React via `html-react-parser` or similar, walk the tree, swap bound nodes for typed React components. More expressive (real components for repeatables, typed children) but heavier.

The agent should recommend based on bundle/perf tradeoffs and the React Server Component model the codebase already uses.

### 5.6 Editor pre-fill timing

Silex client-config runs `silex:grapesjs:start` (before init) and `silex:grapesjs:end` (after init). Where does CMS pre-fill hook in?

- Option: a new event after the document loads but before the user can edit. Fetch CMS via authenticated API route. Call `editor.setTraitValue(traitName, value)` per binding.
- Risk: the published HTML now contains DB values too, so on save the values get baked into Nextcloud storage. Need to decide if save-time strips CMS-bound values back to placeholders, or accepts them as a snapshot.

Owner preference per §3.2: render-time hydration is authoritative. Therefore Silex pre-fill is a *display convenience*, not a save path. The save format should keep template HTML free of DB values where possible.

### 5.7 Repeatable collections in the editor

`threads.sessions[]`, `workshop_pages.gallery_image_urls[]`, future `workshop_testimonials` — owner asked for a custom GrapesJS repeatable trait UI eventually. For now: repeatables are DB-only via the hub form. The binder must still render them at request time. Future GrapesJS trait UI is deferred but the binder shape should not preclude it.

### 5.8 Subdomain inline editor architecture

The "edit-mode toggle" lives where in the codebase? Options:

- A client component wrapper around the rendered template HTML that listens for owner-only `?edit=1` query param + role check, swaps each `data-cms` node into a contenteditable + save-on-blur.
- A separate `/[slug]/edit` route that renders the template with form fields instead of read-only nodes.
- A server-action-driven Inline form like `useFormState` per field, with optimistic UI.

Attendee-change detection (§3.9) should live in the server action layer — `upsertWorkshopPageAction` or its sibling for `threads` updates. Diff old vs new on the server, return a flag to the client, client shows the modal.

### 5.9 SSO across domain ↔ subdomain ↔ Nextcloud

Out of scope for binding, but flagged as the next blocker after the binding lands. Today: three auth contexts. Cookie domain, Nextcloud OIDC integration, and the wildcard subdomain handling all need a unified plan. The 1M agent can sketch this if it has time, but the binding work should not block on it.

---

## 6. Suggested Implementation Phases

These are ordered to deliver visible value early, then generalize.

**Phase 1 — Render-time binding for the public workshop URL**

1. Add `threads.slug` column + backfill + uniqueness constraint scoped by `org_id`.
2. Add route `/sites/[slug]/[contentSlug]/page.tsx` (or middleware rewrite) that loads thread + sidecar + author profile.
3. Build `packages/cms-bindings` with a `renderTemplateWithData(html, manifest, data)` function. Workshop is first consumer.
4. Repoint `/preview/workshop` to canonical template tree; reuse it as the designer preview path.
5. Decide and lock §5.1 + §5.5.

**Phase 2 — Hub workshop CMS form** (per `HANDOFF.md` plan)

1. `/hub/workshops/[orgSlug]` list page.
2. `/hub/workshops/[orgSlug]/[threadId]` form. Server component loads thread + sidecar; `WorkshopPageForm` client component wraps `upsertWorkshopPageAction`.
3. Tabbed: Core / Details / Pricing / Registration / About / Author note / Optional sections.
4. Attendee-change diff detection on server actions; modal prompt to send notification.

**Phase 3 — Generic binder + second kind**

1. Add an event template + manifest + (optional) computed-field module under the same package.
2. Confirm the binder is kind-agnostic by getting events to render through it.
3. Codify the "add a new kind" recipe.

**Phase 4 — Subdomain inline editor**

1. Edit-mode toggle on `/[slug]` for owners.
2. `data-cms`-aware inline contenteditable + save-on-blur.
3. Server-side diff → attendee notification prompt.

**Phase 5 — Silex editor pre-fill**

1. Silex client-config fetches workshop CMS via authenticated route.
2. `editor.setTraitValue` per binding on document load.
3. Save-time strip of DB-bound values so template HTML stays a layout shell.

**Phase 6 — SSO unification** (separate brief)

---

## 7. Files the 1M Agent Must Read

Tier 1 (must understand to design the binder):

- [`packages/silex-nextcloud-connector/src/templates/workshop/manifest.json`](packages/silex-nextcloud-connector/src/templates/workshop/manifest.json)
- [`packages/silex-nextcloud-connector/src/templates/workshop/cms/workshop.schema.md`](packages/silex-nextcloud-connector/src/templates/workshop/cms/workshop.schema.md)
- All `packages/silex-nextcloud-connector/src/templates/workshop/html/eac-ws-*.html`
- [`packages/silex-nextcloud-connector/src/client-config.js`](packages/silex-nextcloud-connector/src/client-config.js)
- [`apps/arts-collective/src/components/silex-layout.tsx`](apps/arts-collective/src/components/silex-layout.tsx)
- [`apps/arts-collective/src/components/silex-embeds.tsx`](apps/arts-collective/src/components/silex-embeds.tsx)
- [`apps/arts-collective/src/lib/cms/schema.ts`](apps/arts-collective/src/lib/cms/schema.ts)
- [`apps/arts-collective/src/lib/cms/actions.ts`](apps/arts-collective/src/lib/cms/actions.ts)
- [`apps/arts-collective/src/lib/org.ts`](apps/arts-collective/src/lib/org.ts)
- `packages/db/migrations/038_workshop_pages.sql`

Tier 2 (context for routing, auth, and existing layout):

- [`apps/arts-collective/src/app/sites/[slug]/page.tsx`](apps/arts-collective/src/app/sites/[slug]/page.tsx)
- [`apps/arts-collective/src/app/hub/page.tsx`](apps/arts-collective/src/app/hub/page.tsx)
- [`apps/arts-collective/src/middleware.ts`](apps/arts-collective/src/middleware.ts)
- [`apps/arts-collective/src/lib/session.ts`](apps/arts-collective/src/lib/session.ts) (and any cookie-domain config)
- [`apps/arts-collective/src/components/cms/create-content-dialog.tsx`](apps/arts-collective/src/components/cms/create-content-dialog.tsx)
- `packages/silex-nextcloud-connector/HANDOFF.md`
- `HANDOFF.md` (eac-repo root)

Tier 3 (only if SSO sketch attempted):

- `nextcloud-stack/docker-compose.yml`
- Anything in `apps/arts-collective/src/app/api/auth/*`

---

## 8. Network-Expansion Principles (longer arc)

These shape what the binder must avoid foreclosing.

1. **The network is many subdomains, one runtime.** Adding an org doesn't deploy code. The binder must be data-driven enough that new kinds + new templates ship as content, not as forks.
2. **Artists eventually leave for their own domain.** The system must export cleanly. A workshop's data should be portable as a JSON document + its template HTML, with no hidden coupling to platform-only services.
3. **Members are guests until they become contributors.** The subdomain is read-only by default; sign-in unlocks RSVP, comments, posting to feed, and (for permissioned members) editing. The binder should not assume a single "owner" identity.
4. **The hub is the workshop. The subdomain is the gallery.** The hub is where structured work happens. The subdomain is where it shows. Both edit, but with different affordances.
5. **Templates are public utility.** Every template the network ships should be useful to any org, not bespoke to one. The "fork into custom Silex page" mechanism was rejected for this reason.
6. **Logistics over decoration on transactional pages.** Workshop, event, registration: these pages serve a person trying to do a thing. Decoration is the org landing's job.
7. **Trust scales the network.** Date changes notify attendees. Cancellations refund. Registration deadlines are honored. The binder layer is also the trust layer because it's where edits become visible.

---

## 9. Out of Scope (do not solve in this brief)

- SSO unification (Phase 6, separate brief)
- Member roles beyond owner / signed-in / signed-out
- Internationalization
- Accessibility audit (assumed to be a continuous practice, not a phase)
- Payment / checkout flow (registration_url is external for now)
- Testimonials and related-workshops collections (deferred per `workshop.schema.md`)
- Discipline taxonomy enum (free text for now)
- Mobile vs. desktop balance (assumed mobile-first; not the binder's concern)

---

## 10. Success Criteria

The binder + first phase is done when:

1. A workshop created in the hub form appears at `acme.domain.com/[slug]` with all DB fields rendered into the shared template HTML.
2. Editing a field in the hub form is reflected on the public URL within one revalidation cycle, without republishing in Silex.
3. Optional sections with empty data are absent from the rendered HTML — no empty `<section>` tags.
4. Attendee-affecting edits trigger the notification prompt before saving.
5. A second kind (event) can be added by shipping a template + manifest + computed-field module, without touching the binder package.
6. `/preview/workshop` renders the canonical template tree with mock data for designer preview.
7. The Silex editor still works for layout/style edits; nothing in the binder layer breaks the existing publish flow.
