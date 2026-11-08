# Hub cards: Site Builder + Member Management, plan (2026-11-08)

Lead: system32-9c. PM: system32-08. Brief: `BRIEF.md`; spec: `README.md` (copy final, used verbatim).
Inputs: `NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` §4.2/§4.3/§5, `packages/studio/src/forms/contract.ts` +
`publishing-forms-handoff/PLAN.md` §5, PM board "Lane B survey", `SMART_COMPONENTS_KIT` §4, a read-only code
sweep of branch `work/2026-11-08` (facts below cite files). Nothing built yet.

## 0. In one paragraph

A new package, **`@elkdonis/hub`**, holds the card contract (`defineHubCard`) and the two cards. Each card is
one client UI (face, pop-up, detail page) fed by one server loader that takes a `site` and a `viewer`, never app
config. Every write goes through **registry entries** in `@elkdonis/actions`, with the guard in
`services`. What differs per host (Puck edit URL, the app's template pages and copy slots, how its theme
vars map onto colour roles, upload endpoint) is a **`HubCardHost`**, shaped like the forms' `FormHost`. The
kit (`packages/org-site`, phase 0 starts 11-09) doesn't exist yet. Until it does, the pilot hosts mount the cards
with three thin real files each, which the kit's `/hub/[...kit]` entries later replace with no card change.
Styling uses only `--hc-*` tokens: hook `--eac-hub-*` → the host's `--sf-*` → default. The Industry look is one
subtree theme (`[data-hub-theme="industry"]`), built the same way as the forms' `broadsheet.css`.

## 1. Package and contract

### 1.1 Location
`packages/hub` (`@elkdonis/hub`), not `cms-ui/hub`. Reasons:
- cms-ui is transpiled by every app;
- the faces in `cms-ui/hub` are a different generation (no contract);
- `@elkdonis/content` already shaped `PublishCardFace`/`PublishPopup` "for the defineHubCard contract" (`packages/content/src/ui/PublishCard.tsx:15`).

The hub package will wrap the Publish card later. `content` stays independent of `hub`.

```
packages/hub/src/
  contract.ts            types only: defineHubCard, HubSite, HubViewer, HubGate, HubCardHost, theme + icon map
  gates.ts               gate/section evaluation (pure)
  ui/                    shared primitives: Blueprint frame, Popup, DetailPage+Tabs, ConfirmDialog, Toast,
                         Segmented, SquareToggle, ExpandRow, RoleChip, Thumb/Placeholder (client, no next/*)
  members/               card.tsx (defineHubCard), Face, Popup, Detail (People/Arrivals/Visitors/Permissions),
                         SmallOrg; model.ts (Member, Arrival, FaceData)
  site-builder/          card.tsx, Face, Popup, Detail (Pages/Theme/Profile), NewPageDialog, SlotEditor; model.ts
  server/                server-only: members.load/loadDetail, siteBuilder.load/loadDetail, host-resolve helpers
  theme/hub-cards.css    --hc-* output tokens + all component CSS
  theme/industry.css     [data-hub-theme="industry"]: Industry tokens → --hc-*, incl. 100–900 ramps
```

### 1.2 `defineHubCard` (the architect's §4.2 shape, split for the client/server boundary)
A single object can't carry both a db-touching `load` and client components through Next's boundary. So each
card exports two halves with the same `id`:

```ts
// contract.ts
export type HubGate = 'public' | 'signed-in' | 'member' | 'guide' | 'owner';
export interface HubSite {            // from defineSite (custom app) or loadSiteContext (shell)
  orgId: string; name: string; domain: string; baseUrl: string; timeZone: string;
  features: Record<string, boolean>;  // ceiling; runtime on/off from org_capabilities when it exists
}
export interface HubViewer { userId: string; name: string; role: OrgRole | null; isNetworkAdmin: boolean }

// members/card.tsx  (client-safe)
export const membersCard = defineHubCard({
  id: 'members', title: 'Members', icon: 'users',
  capability: null, gate: 'guide',
  sections: { visitors: { gate: 'owner' }, storage: { gate: 'owner', capability: 'nextcloud_access' } },
  Face, Popup, Detail,                // each receives { data, host, can, nav }
  actions: ['org-person-role', 'org-person-listed', 'org-person-remove', 'org-arrival-welcome', 'org-arrival-dismiss'],
});

// members/server.ts (server-only)
export const membersServer = defineHubCardServer({
  id: 'members',
  load:       (site, viewer) => Promise<MembersFaceData>,              // face + pop-up
  loadDetail: (site, viewer, tab) => Promise<MembersDetailData>,       // detail page
});
```

- **`can`.** It is computed on the server inside `load` (e.g. `can.changeRole(personId)`, `can.seeVisitors`) and sent as data. Read-only chips and tooltips come from it. The UI never re-derives a gate.
- **`nav`.** The card's own state machine: card → pop-up → `/hub/<id>?tab=`. Deep links use `?tab=` plus `&row=` for an expanded row.
- **`HubCardHost`** (client). This is everything that differs per host. It mirrors `FormHost`:
  - links: `puckEditHref(slug)`, `liveHref(path)`, `themeEditorHref(pageKey?)`, `hubHref(card, tab?)`
  - `actionsEndpoint`
  - `uploadImage(file)`
  - for Site Builder: `templatePages` (§3.2), `pageStarts` (sunjay `NEW_PAGE_STARTS`), and `themeAdapter(vars) → SiteThemeSummary`
  - `icons` (name map, as in forms)

  I'll propose to system32-cd that `FormHost` and `HubCardHost` share a `HostLinks` base.
- **Mounts.**
  - Pilot hosts, until the kit lands, use real files:
    - `app/hub/members/page.tsx`
    - `app/hub/site/page.tsx`
    - the face on `app/hub/page.tsx`
    - `app/api/actions/[...]/route.ts` via the existing `actionRoutes()`
  - The kit's `/hub/[...kit]` and `/api/[...kit]` entries later replace those files, and the card code doesn't change.
  - The shell mounts the same cards under `/sites/[slug]/hub/*`.

### 1.3 Theme (aligned with forms §5)
- **The chain.** Components use only `--hc-*`. Each one resolves `--eac-hub-*` hook → host `--sf-*` (surface.css) → `--paper`/`--ink`/`--line` → default. `--eac-hub-rubric` already exists in `cms-ui/hub/hub.css`, so the hook namespace is taken from there.
- **Default render.** The cards wear the org's palette.
- **Industry.**
  - `industry.css` redefines `--hc-*` under `[data-hub-theme="industry"]`, as `broadsheet.css` does for `--frm-*`.
  - That covers the accent and neutral ramps (100–900), square radius, `+` corner marks, and Barlow and Barlow Condensed from `@elkdonis/fonts` (both are in `catalogue.ts:193,208`).
  - Orgs without ramps get them derived with `color-mix` from accent/ink, so every state in the spec has a token.
- **Accents.** Each filled accent gets an `-on` token. Paragraph-size accent text uses `accent-700` or darker (spec rule).
- **Icons.** Lucide names are mapped through `host.icons`, the same as forms' `FormIconMap`.

## 2. Member Management: circuitry map

| Need (README) | Have | Missing / to do | Replaces |
|---|---|---|---|
| People list, roles, joined, listed, arrived-from | `services/org-people.ts` `listOrgPeople` (joins `user_organizations`, `users`, `org_profiles`, latest `network_arrivals`) | handle and last-seen fields (check `users` for a handle/last-seen column; else "seen" is dropped or derived from `analytics_events`, decision) | ifac `lib/manage.ts` `listManageMembers` (duplicate) |
| Change role | `setOrgPersonRole` + guard (refuses self, owner targets, owner grants; queues Nextcloud sync) | registry entry `org-person-role` | ifac `setMemberRole`; **sunjay/elktours/amrit/innergathering `setMemberRoleAction`** (grants owner, no sync: the known bug) |
| Listed toggle | `setOrgPersonListed` | registry entry `org-person-listed` | ifac `setMemberListed` |
| Remove | `org-membership.ts` `removeOrgMember`; ifac `removeMember` (unlist + remove) | **add `removeOrgPerson` to org-people** behind the same guard + sync; entry `org-person-remove` | ifac `removeMember` |
| Arrivals queue | `network_arrivals` (mig 164) + `listOrgArrivals`; `arrival.ts` "follow" makes a viewer row | queue = arrivals not handled and not already non-viewer members, oldest first; **welcome/dismiss state needs columns** (§6); entries `org-arrival-welcome` (adds/sets role, unlisted, queues sync) and `org-arrival-dismiss` | `ArrivalsTable` on ifac/innergathering/elktours people pages |
| Storage status per person | `nextcloud_sync_requests` (mig 139) is **org-level**, with no subject; `getNextcloudAccessOverview` | per-person "Syncing" needs `subject_user_id` on the request (§6). Until then the card shows org-level "{n} syncs in flight", and a person shows Syncing while an org request they triggered is open, matched on `requested_at` (approximate, marked) | ifac `/manage/cloud` `NextcloudAccessPanel` (see Q5) |
| Storage column gate | `org_grants` capability `nextcloud_access`, `canManageNextcloudAccess` | section `storage` gated on owner + grant; hidden with no grant | n/a |
| Visitors (owners) | `@elkdonis/analytics/server` `getDashboardData({scope, range})`; `getAnalyticsAccess` = owner/network admin | a small adapter that maps `daily`/`pages`/`sources` → the spec's chart, top pages and stacked sources (network sites from `sources`, check field shape) | `/manage/analytics` `AnalyticsDashboard` on every app (see Q7) |
| Permissions matrix | static from the role table | none | n/a |
| Invite | none (by design) | disabled button, copy verbatim | n/a |
| Small org ≤5 / solo | none | layout branch in Detail and Face | n/a |

Gates come from the spec table, enforced in the services and the registry runners, not only in the UI.

## 3. Site Builder: circuitry map

### 3.1 Table
| Need | Have | Missing / to do | Replaces |
|---|---|---|---|
| Page list | `page-builder/store.ts:113` `listPages` → `{slug, updatedAt}` from `site_config` keys `puck:%` | **title, updated_by, notes, link preview, thumbnail, order** (no columns; §6 `site_page_meta`). v1 without the migration: title from the doc's root props or slug, "by" omitted, site order = path order | sunjay/elktours `/manage/builder` lists |
| Nested pages | slash paths, depth ≤3 (`slug.ts:29-35`) | "Place under" = path prefix (no `parent_id` needed). **"moves with parent" needs a rename operation that moves descendants, which doesn't exist**: out of v1, flagged | n/a |
| Template pages + copy slots | `org_site_sections` (mig 041) edited by **4 editors** (sunjay/innergathering `SectionEditor`, ifac raw-JSON `SectionsEditor`, fourthway typed `SectionForm`) | **one `SlotEditor`** driven by the host's `templatePages` declaration (§3.2); writes through registry `site-section-save` (merge one section's fields, sanitised, `updated_by`) | all 4 editors |
| New page | sunjay `NewPageForm` + `lib/puck/templates.ts` `startingTemplate(slug, start, seed)`; `savePage` (512 KB cap, `validatePage`) | entry `site-page-create` runs the host's start builder server-side; "Copy a page" = `loadPage` → strip resolved keys → `savePage` (a1 to review) | sunjay/elktours `new-page-form` |
| Saved templates | none (templates are code constants) | `site_page_templates` (§6). The tile row shows the designed empty state until it exists | n/a |
| Thumbnails | none | v1 = the designed placeholder everywhere. Capture-on-save needs a headless browser job: later pass, column reserved in §6 | n/a |
| Theme summary | `services/themes.ts` `resolveTheme`, `site_themes(org_id, page_key)` (mig 090); ifac `theme-tokens.ts` roles map 1:1 (`--paper --surface --ink --line --oxide→accent --gold→accent2 --frame`); elktours `SITE_STYLE`; **sunjay stores no theme** | `host.themeAdapter(vars) → {look, headingFont, bodyFont, colors}`. **"Look" (Paper/Framed/Gallery) exists nowhere in code**: the host declares it (ifac Framed, sunjay Paper) until a shared look exists (smart-components §2.6) | ifac `/manage/appearance` (the editor stays, opened by "Edit theme ↗") |
| Page exceptions | `site_themes` rows with `page_key ≠ ''` | list/remove via entry `site-theme-exception-remove`; "Edit ↗" goes to the theme editor with the page | ifac AppearanceCard scope select |
| Profile (identity card) | `/center` `OrgManage` → `OrgPanel` "Details" (`journey-panels.tsx:287`) editing the org profile target (displayName, headline, city, avatarUrl…) via `SurfaceProfileConnectors` | map Name→displayName, Short line→headline, Where→city, Mark→avatarUrl (verify where the org target saves). **Kinds (main + also) have no storage** (§6) | `/center` org card form (Details tab), everywhere |

### 3.2 Template pages are declared by the app (the one per-site slot)
```ts
templatePages: [{ slug: '', title: 'Home', slots: [
  { key: 'hero.image', group: 'Hero', label: 'Hero image slide', type: 'image',
    section: 'hero_image', field: 'url', hint: 'Optional. With no image the hero has one slide fewer.' }, … ] }]
```
- Each slot names its `org_site_sections` key and field.
- fourthway's declaration is the README §1i table, verbatim (the keys are already `hero_image`, `side_banner`, `current_book`, `meeting_structure`, `suggested_books`, `mission`, `about`).
- sunjay and innergathering declare `hero`/`about`/`visiting`/`resources`/`footer`. The footer becomes a shared layout ("Draws every page").
- ifac declares typed slots for the keys it edits as raw JSON today. Its events form moves to the Calendar card, not here.
- In the shell, the declarations come from the template the org's site uses.

## 4. What each card retires, per app (redirect `/manage/<tab>` → `/hub/<card>?tab=`)

| App | Member Management retires | Site Builder retires | Stays (other cards) |
|---|---|---|---|
| ifac (pilot MM) | People & access, Visitors, Cloud storage (Q5) | Site copy (sections half), Appearance (summary; editor kept) | Overview, Artists & dealers (**Q4**), Submissions, Email, Store, events → Calendar |
| sunjay (pilot SB) | People, Visitors | Page builder, Site copy | Content, Pages (feeds) → Content; Series |
| fourthway | Visitors | The book, Structure of a meeting, Books ahead, Hero/banner & copy | Overview, Reading groups, New reading group → Content |
| innergathering | People, Visitors | Site copy | Content, Pages, Video, Center promo |
| elktours | People, Visitors | Page builder, Site copy | the tours vertical, Journal, Pages |
| amrit-canada | People, Visitors | Site copy (`manage/pages`) | Content, feeds, compose |
| all (via `/center`) | n/a | org card "Details" form | Center connections |

The retirement of a tab happens only after the card runs on that host. Redirects ship in the same rebuild.

## 5. Passes (each one is reviewed by me, then reported to the PM. The Sonnet agent does the sweeps and the mechanical detail ports)

0. **Contract + skeleton.**
   - Work: `packages/hub` (contract, gates, ui primitives, `hub-cards.css`, `industry.css`), and a static render harness for both cards on the spec's sample data. Screenshots are compared against the boards.
   - Out of scope: data and app edits.
   - Review: the contract goes to the architect (via PM), system32-cd (theme + host links) and system32-a1 (nothing Puck yet).
1. **Members, read path, ifac.**
   - Work: `members.load`/`loadDetail` on the real services, and the Face, Popup and Detail.
   - The ported pieces: People, Arrivals (read), Visitors, Permissions, small org.
   - Mounted on ifac `/hub` + `/hub/members` (real files). Writes are disabled with a "coming in the next pass" note, which is hidden copy: only in dev.
2. **Members, writes.**
   - Shared service: add `removeOrgPerson` and `welcomeOrgArrival` to `services/org-people.ts`.
   - Registry: add the entries `org-person-*` and `org-arrival-welcome`, and mount `actionRoutes()` on ifac.
   - ifac cleanup: move `lib/manage.ts` and `/api/manage/people` onto `org-people`, then delete the duplicate.
   - **sunjay `setMemberRoleAction` → shared guard** (arch §6 step 1), plus the copies in elktours, amrit and innergathering.
   - Dismiss waits for the arrivals migration.
3. **Site Builder, read path, sunjay.**
   - Work: `siteBuilder.load`/`loadDetail` (`listPages`, `templatePages`, `themeAdapter`, `site_themes` exceptions), and Face, Popup, Pages (grid/list), Theme and Profile (read).
   - Puck links go to `/studio/<slug>`.
4. **Site Builder, writes.**
   - Copy slots: `SlotEditor` + `site-section-save`. This replaces sunjay's `SectionEditor` first.
   - Pages: New page (`site-page-create`, with Blank/Services/Writing/Copy a page).
   - Profile: the identity card save goes through the existing profile connector (name, line, where, mark).
   - Theme: exception removal.
5. **Second hosts + retire.**
   - Members renders on sunjay. Site Builder renders on fourthway (the Book Readers sample is the spec's own case, so its slot declaration proves the unified editor).
   - Redirects and tab removal for ifac and sunjay. The PM deploys.
6. **After the migrations are OK'd.** Notes, page meta (title/by/link preview), saved templates, the arrivals queue state, per-person sync, and org kinds. Thumbnail capture is a separate later job.
7. **Fan-out.** innergathering, elktours, amrit, through the kit once phase 1 lands (or as real files if it slips).

## 6. Migrations needed (none written or run until Justin OKs; numbers from 256)

| # | Change | For | Note |
|---|---|---|---|
| A | `site_page_meta(org_id, page_key, title, notes, link_preview, thumbnail_url, thumbnail_at, sort_order, updated_by, updated_at)`, PK `(org_id, page_key)`, keyed like `site_config` `puck:<slug>` | page title/"by"/notes/link preview/thumbnail/order | one table instead of four columns elsewhere |
| B | `site_page_templates(id, org_id, name, description, from_page_key, puck_data jsonb, block_count, created_by, created_at)` | Save as template, Saved templates | snapshot semantics (spec) |
| C | `network_arrivals` + `handled_at, handled_by, outcome ('welcomed'\|'dismissed')` | arrivals queue, Dismiss | additive, nullable |
| D | `nextcloud_sync_requests` + `subject_user_id` (nullable) | per-person "Syncing" | additive |
| E | org kinds: `primary_kind`, `also_kinds text[]` on the org identity (on `organizations`, or wherever the org profile target saves) | Profile tab | **not** `org_capabilities`: the spec says the profile doesn't switch cards. Coordinated with the architect's step 3 so flags and kinds don't overlap |
| (arch) | `org_capabilities` | card/section `capability` keys | the architect's table. Until it exists, `capability` reads `site.features` and `org_grants` |

## 7. Questions

For Justin (via PM):
1. **Owner grants.** I keep the shared guard: no one is made owner from the hub. The card drops "Owner" from role selects and doesn't build the make-owner confirm. OK? (The copy stays in the package, unused, in case it changes.)
2. **Guides.** The spec says only owners change roles and listing, and guides welcome only as viewer. The shared guard (`canManageOrgPeople` = owner|guide) lets guides do both. Should the shared guard be tightened to the spec? Recommend yes. It also matches today's sunjay behaviour.
3. **Migrations A–E.** OK to write them (run later on your say)? Without them, v1 ships without notes, saved templates, Dismiss, per-person sync or kinds; the designed empty states show instead.
4. **ifac "Artists & dealers"** creates placeholder profiles. The spec excludes those ("roster service later"). Keep that tab until the roster service exists, so the card covers only Listed? Recommend keep.
5. **Cloud storage panel** (grant status, queue a sync, Nextcloud link). There's no tab for it in the spec. Put it under Permissions as a "Shared storage" block for owners? Or keep `/manage/cloud`?
6. **Theme on the pilots.** Industry (as designed) or each org's palette? Recommend Industry on the pilots for review, then the org palette as the default.
7. **Visitors.** The spec's simplified view replaces `AnalyticsDashboard`. Keep a "Full analytics ↗" link to the old dashboard? Recommend yes, owners only.
8. **Thumbnails.** The placeholder only in v1, and screenshot capture later (a headless browser job on eris). OK?

For system32-cd: one ramp/`-on` token helper shared by `--frm-*` and `--hc-*`, a shared icon-name map, and a `HostLinks` base type for `FormHost`/`HubCardHost`.

For system32-a1: Site Builder only reads Puck docs and calls `savePage`. "Copy a page" and saved templates copy a whole doc. Is `stripResolvedKeys` (or today's hand lists) required on that path? No block ids or props change.

For the architect: registry entries as the write path on custom hosts means mounting `actionRoutes()` on ifac and sunjay before the kit. `resolveActionOrg` falls back to `getOwnedOrgId`; the entries need the org from `site` instead. OK to add a site-scoped actor org?
