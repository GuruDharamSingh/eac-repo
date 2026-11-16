# Dock loop, slice 1: prove it on `getting-started` (design, 2026-11-16)

Status: **design only. Nothing built, nothing written to `apps/`, `packages/*/src`, the DB or git.** Implementation waits for the lead's "go". Plan: `DOCK_RAILS_PLAN.md` (P1 Registry, P2 Dock host; L2, L3, L5, L6, §5a). Recommendations: `RECOMMENDATIONS_2026-11-16.md` §4 item 3. Brief: `LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §3.3, §3.4, §5g.

## 0. The slice in eight lines

1. `ActionMeta` gains `address`, `confirm`, `risk`, `roles`. Values come from a new curated `atlas/entries.ts` (16 rows, one per entry) that points at the atlas rows for wording. A script emits the client-safe `src/registry-data.ts`; `check:registry` re-emits and compares.
2. Only `approved` confirm text shows live. Wave 1 and wave 3 are unanswered, so every one of the 16 is `draft`. Live shows a neutral **generic** confirm card; the draft text shows only in dev/preview or to a global admin, tagged "Draft wording".
3. `data-eac-anchor` goes on 15 sites in 5 files (`cms-ui` ProfileSurface, journey-panels, ArtworkSurface, ComposeSurface, and `studio` StudioShell). `anchorProps` lives in `@elkdonis/actions/anchor` for apps; `cms-ui` and `studio` write the literal attribute (no new dependency, no cycle).
4. The dock gets four cards: **Confirm** (replaces one-click run), **Route** ("Take me there", return ticket `?eac-step=`, "Back to the trail" while away), **Done**, and a **course picker**. The hard-coded `COURSES` goes.
5. Money entries (`store`, `payouts`, `service`, `artwork`) are route-only: no confirm card, no run. This also closes a hole: `isDockAction('store')` is true today.
6. New table `lms_dock_state` (migration **275**, additive, one row per user) holds the current course/step, the departure (return path, ticket) and the last tick.
7. Pushed completion: an optional `onPerformed` hook on `ActorContext`, called after `record()` in `performAction`. The arts-collective host implements it with one new `@elkdonis/lms` function (`settleTasksNaming`) that re-checks every open step naming the entry through the existing `completeStep` path. Status stays authoritative.
8. Test on a dev preview with a throwaway account: step goes there, outlines the control, person presses, returns, ticks; then a do-step (`gain-space`) confirms, runs, ticks. Cleanup list in §6.

## 1. What I found that shapes the design

Read before relying on any of it; all from code and read-only SQL on 2026-11-16.

- **Published `getting-started`** (course `ztDv738ALGUI_qKojKjVV`, version `QYf2bpBJihCAQB4o4xEF8`): 5 modules, 21 steps, **16 bound to entries**. Modules: arrive (4), your-page (4), offer (4), collective (6), go-deeper (3, all unbound). Live use is tiny: 3 active and 1 completed enrolment, 60 `action_events` rows in all.
- **The 16 steps** (module.step, title, entry, scope, required): 1.2 Your name and face `profile` person req; 1.3 Take your space `gain-space` person req; 2.1 Your page in the directory `listing` req; 2.2 Write your first piece `studio` req; 2.3 Show it where you belong `show-on`; 2.4 Your files `cloud`; 3.1 Offer a service `service` req; 3.2 Open a store on the market `store` req; 3.3 Put up a work `artwork` req; 3.4 Get paid `payouts` req; 4.1 Name it and give it an address `org`; 4.2 Say what it is for `org-details` (org); 4.3 Your first offering on your site `org-offering` (org); 4.4 Who is in it `org-people` (org); 4.5 Mail from your collective `org-email` (org); 4.6 Going live `org-site` (org). Unlock is `sequential` throughout, so a step settled out of order stays open until its predecessors are done (pushed completion respects this; see §4.3).
- **Only two of the 16 are "do" steps in the dock** (presentation kind `run` or `form`): `gain-space` (run) and `org-email` (form). Every other one is "go": a surface, frame, popup or link that the person presses themselves. The person's own press is their confirmation there, so the confirm card applies to `gain-space`, `org-email`, and the dock's other one-click runs (post Publish/Lead, channel moves).
- **The atlas has no arts-collective address for five of the 16.** `store`, `org`, `payouts`, `service`, `artwork` are mapped only to ifac/sunjay hosts (`orgapps.journeys`, `orgapps.money`, `orgapps.artwork`), although the same cms-ui surfaces serve arts-collective. `listing`, `org-offering`, `org-people` have **no atlas row at all** (status-only entries). `org-site`'s row (`confirm-org-address`) and `cloud`'s row (`link-cloud-sign-in`, app `admin`) are class `admin`. Address therefore cannot be copied from the atlas; it is written once per entry (§2).
- **Nothing is approved.** All confirm drafts are `draft`: wave 1 for profile, gain-space, show-on, org-details, org-email, store, artwork, payouts, service (save); wave 3 for studio and service (status). `reports/wording-wave-01.md` has 86 cards and no ticks.
- **The surface address convention already works**: `/hub/network?surface=profile:edit` etc. (`cms-ui/src/surface/url.ts`; `TaskBox.tsx` already falls back to it). `urlWithSurface` only sets or deletes its own param, so `?eac-step=` survives popup open/close.
- **`@elkdonis/actions` does not depend on `@elkdonis/lms`** and the reverse must stay true, so the completion hook is injected by the host (like `DockLms`).
- **Neither `cms-ui` nor `studio` depends on `@elkdonis/actions`**, and `actions` already imports types from `cms-ui`. A runtime import back would be a package cycle, and a new dep would need the install step (a lockfile change). So they get the literal attribute.
- **`SessionUser` has no admin flag.** The host already has `LmsViewer.isGlobalAdmin` (lms connectors `getLmsViewer`); the dock route uses that for the draft-wording rule.

## 2. Registry fields (P1)

### 2.1 Types (`packages/actions/src/types.ts`, additive, all optional)

```ts
export type ActionRisk = 'money' | 'irreversible' | 'public' | 'emails' | 'others';   // atlas 'none' = empty array
export type ActionRole = 'person' | 'member' | 'guide' | 'owner' | 'admin';

/** Where the control lives (L3). Resolved per org/subject at run time by routeFor(). */
export interface ActionAddress {
  host: 'hub' | 'org-site' | 'app';
  app?: string;          // host 'app': which app serves it
  path?: string;         // template: '/hub/network', '/hub/organization?org={org}', '/studio'
  surface?: string;      // serialized descriptor (cms-ui surface/url.ts): 'profile:edit', 'journey:auction', 'artwork'
  anchor?: string;       // data-eac-anchor to outline; default = the entry id
  dock?: true;           // done in the dock itself (run/form): nothing to travel to
  external?: true;       // another origin (Nextcloud): opened as a popup, no return ticket
  how?: string;          // one line for people and docs
}

export interface ActionConfirm {
  text: string;                                  // 'Set up your space? You get a folder of your own, ...'
  status: 'draft' | 'proposed' | 'approved' | 'changed';
  wave?: number;
}

// on ActionMeta:
address?: ActionAddress;
confirm?: ActionConfirm;
risk?: readonly ActionRisk[];
roles?: readonly ActionRole[];   // who may perform it; shown to others as context only
```

`ActionRisk` is the atlas `Risk` minus `'none'`. `roles` is the atlas `Actor` minus `visitor/operator/system`.

### 2.2 Where the values come from

- **New curated file `packages/actions/atlas/entries.ts`**: one object per registry entry id (16 now, 49 eventually): `{ address, risk, roles, confirmFrom?: '<area file>:<row id>', confirm?: {...} }`. Entry-level data is separate from capability rows because an entry maps to several rows (profile 2, studio 2, service 2, artwork 2) and the atlas rows carry ifac addresses.
- **`confirmFrom`** pulls `text`, `status`, `wave` from the named atlas row at emit time. Justin's wave answers (which set `approved`/`changed` in the atlas row, per the atlas README) therefore flow into the entry with no second edit.
- **New script `scripts/atlas-emit.mts`** (`pnpm --filter @elkdonis/actions atlas:emit`, same `lms` tsx pattern as the other atlas scripts) writes **`packages/actions/src/registry-data.ts`**: a generated, committed, client-safe `Record<id, {address, confirm, risk, roles}>`. The atlas stays the source (D-13); `src/` never imports `atlas/`.
- **`catalogue.ts`** applies it with `withRegistry`, a sibling of `withAgent` in the `.map(...)` chain (`catalogue.ts:~118`). Helpers: `confirmOf(id)`, `isMoneyEntry(id)` (`risk` includes `money`).

### 2.3 The 16 rows (proposed values; "row" is the atlas row that supplies the wording)

| Entry | Dock kind | Address (host, path, surface, anchor) | Risk | Roles | Wording row (status) |
|---|---|---|---|---|---|
| `profile` | go (surface) | hub `/hub/network` `profile:edit`, anchor `profile` | public | person | `edit-my-profile` (draft w1) |
| `gain-space` | **do** (run) | `dock: true` | public | person | `take-your-space` (draft w1) |
| `listing` | go (surface; tab `details` until an address exists, else `show`) | hub `/hub/network` `profile:details` / `profile:show`, anchor `listing` | public | person | **no row**; add `directory-listing-set` (draft, new wave) |
| `studio` | go (frame) | hub `/studio`, anchor `studio` | public | person | `writing-piece-save` (draft w3) |
| `show-on` | go (surface) | hub `/hub/network` `profile:show`, anchor `show-on` | public | person | `choose-sites-for-post` (draft w1) |
| `cloud` | go (popup) | app `nextcloud` `external: true`, no anchor | (none) | person | not needed (link only) |
| `service` | go, **money** | hub `/hub/network` `journey:profile`, anchor `service` | public, money | person | `own-service-save` (draft w1) |
| `store` | go, **money** | hub `/hub/network` `journey:auction`, anchor `store` | public, money | person | `auction-store-publish` (draft w1) |
| `artwork` | go, **money** | hub `/hub/network` `artwork`, anchor `artwork` | public, money | person | `artwork-draft-save` (draft w1) |
| `payouts` | go, **money** | hub `/hub/network` `journey:auction`, anchor `payouts` | money | person | `payout-stripe-start` (draft w1) |
| `org` | go (surface) | hub `/hub/network` `journey:site`, anchor `org` | public | person | `org-site-create` (no wording yet; draft needed) |
| `org-details` | go (surface) | hub `/hub/network` `journey:org:{org}`, anchor `org-details` | public | owner, guide | `save-org-identity` (draft w1) |
| `org-offering` | go (compose; fallback console) | hub `/hub/organization?org={org}`, anchor `org-offering` | public | owner, guide | **no row**; use `org-publish` wording once a row exists |
| `org-people` | go (surface) | hub `/hub/network` `journey:org:{org}`, anchor `org-people` (People tab) | others | owner, guide | **no row** (people changes are the appOnly hub entries) |
| `org-email` | **do** (form) | `dock: true` | emails | owner, guide | `save-org-email-identity` (draft w1) |
| `org-site` | check (nothing to press) | hub `/hub/admin` (admin confirms), no anchor | public | admin | `confirm-org-address` is admin class: no confirm |

Notes: the atlas `risk: ['none']` for `cloud` is `[]`. `service`, `store`, `artwork` carry `money` because their atlas rows do. The five new or missing rows (`listing`, `org`, `org-offering`, `org-people`, `studio`'s arts-collective host) are three small atlas additions and one wording ask; list them for Justin with wave 7. Until then they show the generic card (only relevant for do-steps; none of those five is one).

### 2.4 `check:registry` additions (`scripts/check-registry.mts`)

Hard failures (exit 1):
1. `registry-data.ts` is stale: re-run the emit in memory and compare to the file.
2. A `runnable` entry has no `risk` array (empty is fine, absence is not) once it appears in `entries.ts`; every entry in `entries.ts` exists in the catalogue.
3. A `do` entry (runnable and presented as `run`/`form`, not `appOnly`, not money) has no `confirm`.
4. `money` entry with `address.dock` (a money entry must be somewhere a person presses).
5. `address.anchor` set but not found: grep the repo for `data-eac-anchor="<id>"`, `anchorProps('<id>'`, or `anchor: '<id>'` (under `packages/cms-ui/src`, `packages/studio/src`, `apps/*/src`). New script `check-anchors` inside the same file.
6. `address.surface` does not parse: `parseDescriptor(surface with {org} replaced)` from `cms-ui/surface` returns a descriptor.
7. `confirm.status === 'approved'` with empty `text`.

Warnings (printed, exit 0; promote to failures when waves are answered):
- A person-facing entry without `confirm`, `address` or `risk` (the plan's full rule), so the 49-entry catalogue is not a wall of red during slice 1.

### 2.5 Live wording rule (wave 1 unanswered)

One pure function in the client-safe package, `confirmView(meta, mode)` (`packages/actions/src/confirm.ts`):

| `mode` | `confirm.status` | Result |
|---|---|---|
| any | `approved` or `changed` (with Justin's text) | the text, no tag |
| `draft-visible` | `draft` / `proposed` | the text with a "Draft wording, not approved yet" tag |
| `live` | `draft` / `proposed` / absent | **generic**: "**{label}.** This runs now, on your account." + risk badges from `risk` (data, not wording) |

`mode` is chosen server-side in the dock route: `draft-visible` when `process.env.NODE_ENV !== 'production'` (any dev preview) or `viewer.isGlobalAdmin`; otherwise `live`. The route returns the already-resolved card (`confirm: {kind: 'text'|'draft'|'generic', text}`), so a client can never read a draft it should not show, and the draft text is not in the JS bundle of an ordinary visitor (the registry-data file is client-safe and does contain drafts; that is acceptable because it is source data, but the **dock never renders from it**, only from the route's answer).

The generic card is chrome, not entry wording: it contains no claim about what changes. That keeps "only approved text live" true. Recommend Justin answers wave 1 for `gain-space` and `org-email` first; those two plus the dock's post and channel runs are the only cards a person will see.

## 3. Anchors (L3)

### 3.1 The helper

`packages/actions/src/anchor.ts`, exported as `@elkdonis/actions/anchor` (add to `package.json` `exports`; zero imports, client-safe):

```ts
export const EAC_ANCHOR = 'data-eac-anchor';
export function anchorProps(id: string, opts: { subject?: string } = {}) {
  return { [EAC_ANCHOR]: id, ...(opts.subject ? { 'data-eac-subject': opts.subject } : {}) } as const;
}
```

- **Value = the registry entry id** (the dock knows ids, not atlas row ids). The atlas rows' own `anchor:` strings (`edit-my-profile`, `take-your-space`, `choose-sites-for-post`) are capability ids; `entries.ts` carries the entry-id anchor and ignores them.
- **Apps** spread `{...anchorProps('x')}`. **`cms-ui` and `studio`** cannot import it (cycle / install), so `cms-ui`'s `SurfaceAction` gets `anchor?: string` and `ActionButton` writes `data-eac-anchor={action.anchor}`; JSX-only spots write the attribute literally. `check-anchors` greps both forms.
- Exactly one **visible** match per id on a page is the rule; the dock outlines the first visible one.

### 3.2 Where the attribute goes (file:line as read 2026-11-16)

Steps that route to a surface are all served from `/hub/network?surface=…`, so the controls are in `packages/cms-ui` (shared by every app; the attribute is inert elsewhere).

| Entry | Control | Place | Change |
|---|---|---|---|
| `profile` | **Save** in the profile card edit mode | `packages/cms-ui/src/surface/surfaces/ProfileSurface.tsx:449` (`actions.push({ label: saving ? "Saving…" : "Save", primary: true ... })`) | add `anchor: "profile"` |
| `listing` (no address yet) | **Save details** | `ProfileSurface.tsx:455` | add `anchor: "listing"` |
| `listing` (address set; the directory switch) | the "Network directory" `role="switch"` for row `you` | `ProfileSurface.tsx:~907` (the `<button role="switch">` in `presenceCell`) | `data-eac-anchor={row.key === "you" && column.key === "directory" ? "listing" : undefined}` |
| `show-on` | the post checkbox list under "Show on" | `ProfileSurface.tsx:~1043` `listingsPanel()` `<section>` (the `<ul>` wrapper) | `data-eac-anchor="show-on"` on the section |
| `service` | **Offer a service** (new) and **Publish** (save) | `packages/cms-ui/src/surface/surfaces/journey-panels.tsx:715` and `:702` | `data-eac-anchor="service"` on `:715`; on `:702` when editing |
| `store` | **Open your store** | `journey-panels.tsx:218` (SellingPanel) and `:743` (OfferTab) | `data-eac-anchor="store"` on both (never both visible) |
| `payouts` | **Connect** | `journey-panels.tsx:271` (SellingPanel) and `:816` (PayoutBlock) | `data-eac-anchor="payouts"` |
| `artwork` | **Publish all** (and Save as draft stays unanchored) | `packages/cms-ui/src/surface/surfaces/ArtworkSurface.tsx:253` | `anchor: "artwork"` on the `Publish all` action |
| `org` | **Create** in the site journey | `journey-panels.tsx:1226` (`<button type="submit">`) | `data-eac-anchor="org"` |
| `org-details` | **Save** in `IdentityForm` | `journey-panels.tsx:957` | `data-eac-anchor="org-details"` when `target` is an org |
| `org-people` | the **People** sub-tab | `journey-panels.tsx:334-336` (`SubTabs` items) / `:88` the tab button | `anchor` field on the item, written at `:88` |
| `org-offering` | **Publish** in compose | `packages/cms-ui/src/surface/surfaces/ComposeSurface.tsx:307` | `anchor: "org-offering"` on the `Publish`/`Save & publish` action |
| `studio` | **Publish** (bar and card) | `packages/studio/src/StudioShell.tsx:778` (header) and `:1013` (writing card) | `data-eac-anchor="studio"` on each (one visible at a time) |
| `gain-space`, `org-email` | none: done in the dock | n/a | `address.dock` |
| `cloud` | none: external popup | n/a | `address.external` |
| `org-site` | none: nothing to press | n/a | no address |

That is 15 sites in 5 files. **Not found by grep and to be located at build time:** the person's "page address" input for `listing` (the Details tab hint says it is there; `ProfileSurface.tsx` has no `slug` text). If it is a separate field, anchor its Save instead.

### 3.3 Resolving an address (`packages/actions/src/route.ts`, client-safe)

`routeFor(id, { orgSlug, status, links })` returns `{ href, anchor, how, external } | null`:
- `surface` set: `${links.hub}${path}?surface=${encodeURIComponent(surface with {org})}`, using cms-ui's real `serializeDescriptor` (TaskBox's private `serialize` copy is not reused).
- `studio`: `/studio`. `org-offering`: `status.href` (the console) when compose cannot open outside `/learn` (TaskBox's `canOpen` rule: compose only opens when the lesson's stack is for that org).
- Wrong-tab handling: `listing` chooses `profile:details` or `profile:show` from `status.partial`, exactly what `presentAction` already does, by calling `presentAction` and mapping its `descriptor` rather than duplicating the switch.

## 4. The dock host (P2)

### 4.1 What the dock route answers (`GET /api/actions/dock?path=&ticket=`)

`DockData` (server/dock.ts) grows; the same shape is the MCP card `structuredContent` later (D-15). New fields, all optional so the existing post and channel parts are untouched:

```ts
step.kind: 'do' | 'go' | 'check' | 'read'      // from presentation + risk
step.task.route: { href, anchor?, how?, external? } | null
step.task.confirm: { kind: 'text'|'draft'|'generic', text: string, risk: ActionRisk[], money: boolean } | null
trail:  { courseSlug, courseTitle, stepSlug, stepTitle } | null      // the stored current step
away:   { returnHref, stepTitle, anchor?: string } | null            // dock_state.departed_from is set
done:   { stepTitle, courseSlug, nextStepTitle: string | null, courseDone: boolean } | null
picker: Array<{ courseSlug, title, enrolled, doneRequired, totalRequired, current }> | null
```

`dockPost` and `dockChannel` stay as they are, except their one-click Publish / Lead / channel-move buttons also go through the Confirm card (they are `do` runs). Their confirm text: generic until words exist; `thread-publish` and `thread-pin` have atlas rows to bring in with wave 7.

### 4.2 Cards (all in `packages/dock/src/dock.tsx` + `dock.css`; plain CSS on `--eac-dock-*`)

**Confirm card** (replaces `Control` kind `run` and `DockForm` submit, `dock.tsx:~315` and `~345`, and `perform` for post/channel):
- Title: step or move label. Body: `confirm.text`. Badges from `risk` (public, emails, others). Buttons **Confirm** (primary) and **Cancel**.
- Confirm calls `runDockAction(id, input, { org, subject, confirmed: true })`. Cancel closes the card, nothing is called, nothing is audited.
- A form (`org-email`) shows its fields first, then the card, then runs with the form values.
- Server rule (`dock-actions.ts`): a non-money run without `confirmed: true` returns `{ok:false, error:'Confirm it first.', code:'input'}`. This is policy for the UI path, not a security boundary (the person can run the same entry in the console), like the existing door policy.
- Money: `isDockAction` returns false when `risk` includes `money` (fixes `store`, which today passes the allow-list), so no confirm card exists for those.

**Route card** ("Take me there"), for `kind: 'go'`:
- Button calls server action `dockDepart({ courseSlug, stepSlug, returnPath })`: validates `returnPath` is a local path (`^/(?!/)`, no backslash, 600 chars), writes `departed_from`, a fresh 8-char `ticket`, `departed_at`; returns `{ href: route.href + '&eac-step=' + ticket }` (`?` when the href has none). The client does `router.push(href)`.
- On arrival the dock reads `?eac-step=` and `away`. If the ticket matches the stored row it outlines the anchor: `MutationObserver` on `document.body` for up to 12 s waiting for `[data-eac-anchor="id"]` that is visible, then `scrollIntoView({block:'center'})` and sets `data-eac-outlined`. `dock.css`: 3px outline `var(--dk-link)` (`#1d4ed8` on white, 6.70:1; re-measure on dark grounds) with 3px offset; no motion under `prefers-reduced-motion`. No focus stealing. If the anchor never appears (a popup not opened, a role that cannot see it) the card says "Look for: {how}" instead; nothing breaks.
- **While away** the tab and box show **Back to the trail** (not only on the page with the param: it shows on every page while `departed_from` is set, so in-app navigation does not lose the ticket). It calls `dockReturn()`: clears the departure, returns `{ href: departed_from }`, `router.push`. A departure older than 2 hours is ignored.
- `external` routes (Nextcloud popup for `cloud`) keep the current popup behaviour (no departure; the dock re-reads when the window closes).
- When the person is already on the destination path the card says "You are here" and just outlines.

**Done card**: shown when `done` is present: the step title, a tick, "Next: {nextStepTitle}" with **Next step** (marks seen, loads the next trail step) and **Back to the trail** when away. `done` comes from `lms_dock_state.done_*` (written by the completion hook when the settled step is in the person's trail, §4.4), is shown once (`done_seen_at`), and expires after 30 minutes. When `courseDone`, "That is the whole course." and the picker.

**Course picker**: a list inside the box, shown when the person has more than one candidate or taps "Choose a trail". Rows: enrolled active courses (title, `x of y done`) plus `getting-started` with **Begin** (link to `/learn/getting-started`, which auto-enrols) when not enrolled. Choosing calls `dockChoose(courseSlug)`, which writes `course_slug`, clears `step_slug`, and reloads. Tutorials are out of scope (D-18).

Retire `COURSES` (`apps/arts-collective/src/app/api/actions/dock/route.ts:27`) and the `courses` option in `DockOptions`; `dockStep` takes `state` instead (§4.4). The `routinesOnly` rule on `/channel` stays.

### 4.3 Order of candidates in `dockStep` (server/dock.ts)

1. The stored `course_slug` (if enrolled, not completed).
2. `getting-started` if enrolled (the old default; kept so the first visit is unchanged).
3. The person's other active enrolments (existing loop).

Within a course: the stored `step_slug` if still open and allowed, else `continueStep`, else the first open allowed step (existing). Each time the dock settles on a step it writes it back to `step_slug` (insert-or-update, best effort, never throws). The stored step is a convenience for return and the picker; the LMS outline remains the truth.

### 4.4 Which functions change

| Function / file | Change |
|---|---|
| `packages/actions/src/types.ts` | new types; `ActionMeta` gets 4 optional fields |
| `packages/actions/src/catalogue.ts` | `withRegistry` in the map chain; export `confirmOf`, `isMoneyEntry` |
| `packages/actions/src/confirm.ts` (new) | `confirmView(meta, mode)` |
| `packages/actions/src/route.ts` (new) | `routeFor` |
| `packages/actions/src/anchor.ts` (new) | `anchorProps`, `EAC_ANCHOR` |
| `packages/actions/src/server/run.ts` | `ActorContext.onPerformed?`; `performAction` (`run.ts:428`) calls it after `record()` |
| `packages/actions/src/server/dock.ts` | `dockStep` (state order, route, confirm, kind), `dockData` (trail/away/done/picker), `isDockAction` (money refusal) |
| `packages/actions/src/server/dock-state.ts` (new) | `readDockState`, `writeDockStep`, `depart`, `returnFrom`, `markDone`, `markDoneSeen`, `choose`; every function tolerates a missing table (42P01: log once, return null), like `record()` |
| `packages/actions/src/server/index.ts`, `package.json` | exports (`./anchor`, `./route`, `./confirm`) |
| `packages/lms/src/tasks.ts` | new `settleTasksNaming(viewer, { taskId, status })` (below) |
| `packages/lms/src/index.ts` | export it |
| `apps/arts-collective/src/lib/lms/completion.ts` (new) | the host hook: wires `settleTasksNaming` + `markDone` |
| `apps/arts-collective/src/lib/actions/run.ts` | `runAction` passes `onPerformed` in the ctx |
| `apps/arts-collective/src/lib/actions/routes.ts` | `actionRoutes` options pass the same hook for the HTTP door |
| `apps/arts-collective/src/lib/actions/dock-actions.ts` | `runDockAction` gets `confirmed`; new `dockDepart`, `dockReturn`, `dockChoose`, `dockAckDone` server actions |
| `apps/arts-collective/src/app/api/actions/dock/route.ts` | drop `COURSES`; read `ticket`; compute draft-visible mode from `isGlobalAdmin`/NODE_ENV; pass `state` and `links.hub` |
| `packages/dock/src/dock.tsx`, `dock.css`, `index.ts` | the four cards; `DockProps` gets `actions: { depart, return, choose, ackDone }` |
| `packages/cms-ui/src/surface/types.ts:786`, `SurfaceShell.tsx:141` | `SurfaceAction.anchor`, rendered by `ActionButton` |
| `packages/cms-ui/.../ProfileSurface.tsx`, `journey-panels.tsx`, `ArtworkSurface.tsx`, `ComposeSurface.tsx`; `packages/studio/src/StudioShell.tsx` | the anchors in §3.2 |
| `packages/actions/scripts/check-registry.mts`, `atlas-emit.mts` (new), `atlas/entries.ts` (new), `src/registry-data.ts` (generated) | §2 |

### 4.5 Pushed completion (L6)

In `performAction` (`run.ts:428`):

```ts
const { input, result, ctx: used } = await perform(id, ctx, raw);
await record(id, used, input, result, Date.now() - started);
if (result.ok === true && used.onPerformed) {
  try { await used.onPerformed({ id, userId: used.userId, orgId: used.orgId ?? null, via: used.via ?? 'app', subjectId: used.subjectId ?? null }); }
  catch (err) { console.error('[actions] onPerformed:', id, err); }   // never changes the result
}
return result;
```

`ActorContext.onPerformed?: (e: PerformedEvent) => Promise<void>` is optional, so the HTTP doors, the MCP and the hub door are unchanged unless a host passes it. Refused or failed runs do not call it.

New in `packages/lms/src/tasks.ts`:

```ts
export async function settleTasksNaming(viewer: LmsViewer, input: {
  taskId: string;
  status: (task: StepTask) => Promise<TaskStatus>;     // the host's actionStatus
}): Promise<Array<{ courseSlug: string; stepSlug: string; stepTitle: string; completedNow: boolean; courseCompleted: boolean }>>
```

It lists the viewer's active enrolments (`listMyEnrolments`), reads each `getLearnerOutline`, selects steps where `stepTask(step)?.id === taskId`, not done, not `repeat`, `access.allowed`, and calls the existing `settleTaskStep` for each (so `completeStep`, `lms_events`, awards and course completion are the same path as the lesson's). Steps blocked by sequential unlock are skipped and settle when the lesson or dock next looks. Org-scoped steps use `status` with the event's `orgId`. Never throws.

Host hook (`apps/arts-collective/src/lib/lms/completion.ts`): builds the viewer (`getLmsViewer`), calls `settleTasksNaming` with `status: (task) => actionStatus(task.id, { userId, orgId, links: ACTION_LINKS, params: task.params })`, then for each `completedNow` result that matches the stored `course_slug`/`step_slug` writes `done_*` into `lms_dock_state` (`markDone`). Status stays authoritative: nothing ticks unless `actionStatus` says done.

The dock refetches after a run (existing `load()`), on return, and on window focus; `/learn` and the hub cards see the tick on their next render with no revisit needed.

## 5. The current-step store (L5) and the migration

Next free number: **275**. Checked 2026-11-16 with read-only SQL because `node` is not on the host (`scripts/migrate.mjs --status` is `packages/db/scripts/migrate.mjs` and needs a container with `DATABASE_URL`): `app_schema_migrations` newest is `274_elktours_tour_departures_backfill.sql`, 274 files on disk, none pending. Other sessions add migrations (268-274 are untracked in git); re-check the number the moment before applying. The parked `mcp_grants` migration also wants "the next free number": give it 276 if both go.

`packages/db/migrations/275_lms_dock_state.sql`:

```sql
-- 275: lms_dock_state: the dock's current step, departure and last tick, one row per person (2026-11-16).
--
-- DOCK_RAILS_PLAN L5/L6, DOCK_LOOP_SLICE1. Additive; nothing reads it until the dock code ships, and the
-- code tolerates the table being absent (42P01 is logged once, the dock falls back to the LMS outline).
--   course_slug, step_slug  the trail the person chose / is on (a convenience; the LMS outline is the truth)
--   run_id                  reserved for runbook runs (P3); no foreign key until that table exists
--   departed_from, ticket   set when "Take me there" leaves the page; NULL = not away. departed_from is a local path
--   departed_at             a departure older than 2 hours is ignored by the reader
--   done_*                  the last step the completion hook ticked on this trail, shown once as the Done card
-- Deleting the user deletes the row.

CREATE TABLE IF NOT EXISTS lms_dock_state (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  course_slug      varchar(120),
  step_slug        varchar(120),
  run_id           text,
  departed_from    text,
  departed_at      timestamptz,
  ticket           varchar(16),
  done_course_slug varchar(120),
  done_step_slug   varchar(120),
  done_at          timestamptz,
  done_seen_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (departed_from IS NULL OR (departed_from ~ '^/' AND departed_from !~ '^//' AND departed_from !~ '\\' AND length(departed_from) <= 600)),
  CHECK ((departed_from IS NULL) = (ticket IS NULL))
);
```

`users.id` and `lms_enrolments.user_id` are `uuid` (checked). No extra index: lookups are by primary key. Runs on `elkdonis_dev`, which is the production DB, so it needs Justin's go.

## 6. Test plan (dev preview of arts-collective, throwaway account)

### 6.1 Set up (per `docs/reference/testing.md`, "A dev-mode preview of a production app" and "Minting a session cookie")

1. Wait for the production builds to finish (arts-collective is last); check `free -m` (11 GB free now) and that no other `ac-preview` runs.
2. Apply `275_lms_dock_state.sql` (Justin's go). Code tolerates its absence, but the test needs it.
3. Preview, with a scratch `.next` volume (a fresh anonymous one is root-owned and `next dev` fails with `EACCES`):
   ```
   cd ~/eac && sudo -n docker compose run -d --name ac-preview -p 127.0.0.1:3107:3007 \
     -v <scratch>/ac-preview-next:/app/apps/arts-collective/.next \
     arts-collective sh -c 'cd apps/arts-collective && pnpm dev'
   ```
   Pages compile on first request; fetch twice; if every new route answers 500 with an ENOENT on `required-server-files.json`, `docker restart ac-preview`. A dev server reached by container IP rejects `/_next/*`, so drive it as `http://ac-preview:3007` from a browser container on `guru-eac_eac-network`.
4. Browser: `docker run -d --rm --name claude-chrome-dock --network guru-eac_eac-network zenika/alpine-chrome:latest --no-sandbox --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 about:blank` (use your own name and port; other sessions run 9222/9241); a `node:24-alpine` CDP driver. The JSON config is built with Python.
5. Throwaway account: a purpose-made email/password GoTrue user plus its `users` row (not Google; its session JSON is too large), cookie minted per testing.md steps 1-5. Enrol by opening `/learn/getting-started` once (auto-enrol). Complete step 1.1 (reading) from the lesson so 1.2 is unlocked.
6. After the run: put `apps/arts-collective/next-env.d.ts` back to `import "./.next/types/routes.d.ts";` by hand (a dev preview rewrites it, and arts-collective's copy is untracked). That is the one repo file the test touches.

### 6.2 Cases

| # | Case | Expect |
|---|---|---|
| 1 | Open `/hub/network` signed in, dock open | step 1.2 "Your name and face", kind go, Route card with "Take me there"; no run button |
| 2 | **Take me there** | `lms_dock_state` row has `departed_from='/hub/network'`, a ticket; URL becomes `/hub/network?surface=profile:edit&eac-step=<ticket>`; profile popup opens; the Save button has `data-eac-outlined`; tab shows "Back to the trail" |
| 3 | Press Save with a name and headline | the save goes through the profile route, which may not call `performAction`, so no push; the tick comes from the status re-check when the dock refetches or on return, and the Done card shows once |
| 4 | **Back to the trail** | navigates to `/hub/network`; `departed_from`/`ticket` are NULL |
| 5 | Step 1.3 `gain-space` (do) in a preview (draft-visible) | Confirm card with the draft text and the "Draft wording" tag, badge "public" |
| 6 | **Cancel** | no `action_events` row for `gain-space`, nothing changed |
| 7 | **Confirm** | one `action_events` row (`gain-space`, `app`, ok); `completeStep` row in `lms_step_state`/`lms_events`; `lms_dock_state.done_step_slug` set; Done card shows once with "Next: …" |
| 8 | The same with `live` mode (call `confirmView` directly with `mode: 'live'` via a `tsx` probe, and set `NODE_ENV` per request in a unit-style script) | generic card, no draft text; as a global admin, draft shown |
| 9 | Steps 3.2 `store` and 3.4 `payouts` | Route card only, "money" badge; `runDockAction('store', undefined, {confirmed:true})` returns `The dock does not offer that.` |
| 10 | Forged return: `dockDepart` with `returnPath` `//evil.com`, `/\\x`, `https://x` | refused; no row written; the DB CHECK also rejects it |
| 11 | Wrong or stale `?eac-step=` | no outline, no away state, no error |
| 12 | Anchor never appears (a step whose control the role cannot see, `org-details` with no org) | card shows "Look for: {how}" |
| 13 | Missing table: point a second preview at `elkdonis_scratch` (it has no `lms_dock_state`) | dock still shows the step from the LMS outline, one warn line, no 500 |
| 14 | Sequential unlock: do a later step first (`org-email` with an org) | action runs, hook returns it as skipped (not allowed), the lesson ticks it once earlier steps are done |
| 15 | `tsc` for `actions`, `dock`, `lms`, `cms-ui`, `studio`, `arts-collective` (`check-types` 0), `check:registry`, `atlas:check`, `atlas:emit` is a no-op after commit | clean |

### 6.3 Clean up

- Remove: `lms_dock_state` row, `lms_step_state`, `lms_responses` (none expected), `lms_enrolments` and the run row if auto-created, `lms_events` rows are append-only and stay (earlier slices left 1-2 of these), `action_events` rows are append-only (trigger from 245) and stay, `artist_profiles`, `user_organizations` for `oad` (from `gain-space`; it also sets `users.directory_listed = TRUE`, so remove before anyone browses the directory), the `users` row, then the GoTrue user (`DELETE /admin/users/<uid>`).
- `gain-space` also creates the person's Nextcloud folder and media subfolders through DAV (`artist-space.ts:64-73`): delete `users.storage_folder` on Nextcloud via DAV, or run case 7 on an account whose `storage_folder` is NULL (the code skips DAV then).
- `docker rm -f ac-preview claude-chrome-dock`; remove the scratch `.next`; restore `next-env.d.ts`.
- Re-query the account rows first: other sessions purge test rows from `users` while GoTrue keeps the auth user.

## 7. Build order and what needs Justin

Each step ends with type checks for the packages touched. **S1-S5 are source only; nothing is built or deployed until S7.**

| Step | Work | Files |
|---|---|---|
| S1 Registry data | types, `entries.ts` (16 rows), `atlas-emit.mts`, generated `registry-data.ts`, `withRegistry`, `confirm.ts`, `route.ts`, `anchor.ts`, `check-registry` rules, `package.json` exports | `packages/actions/{src/types.ts, src/catalogue.ts, src/confirm.ts, src/route.ts, src/anchor.ts, src/registry-data.ts, scripts/atlas-emit.mts, scripts/check-registry.mts, atlas/entries.ts, package.json}` |
| S2 Anchors | `SurfaceAction.anchor` and the 15 sites; `check-anchors` | `packages/cms-ui/src/surface/{types.ts, SurfaceShell.tsx, surfaces/ProfileSurface.tsx, surfaces/journey-panels.tsx, surfaces/ArtworkSurface.tsx, surfaces/ComposeSurface.tsx}`, `packages/studio/src/StudioShell.tsx` |
| S3 State and hook | `dock-state.ts`, `dockStep`/`dockData`/`isDockAction`, `onPerformed`, `settleTasksNaming`, host `completion.ts` | `packages/actions/src/server/{dock-state.ts, dock.ts, run.ts, index.ts}`, `packages/lms/src/{tasks.ts, index.ts}`, `apps/arts-collective/src/lib/lms/completion.ts`, `lib/actions/{run.ts, routes.ts, dock-actions.ts}`, `app/api/actions/dock/route.ts` |
| S4 Dock UI | Confirm, Route, Done, picker; outline observer | `packages/dock/src/{dock.tsx, dock.css, index.ts}` |
| S5 Migration file | write `275_lms_dock_state.sql` (not run) | `packages/db/migrations/275_lms_dock_state.sql` |
| S6 Verify in preview | §6 | none (preview only; scratch outside the repo) |
| S7 Ship | apply 275, rebuild and restart arts-collective with the build cap the plan names (9 GB; ops.md shows `NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2` as the working build env, and the build waits for a quiet tree: other sessions' uncommitted work ships with it), `tenant-smoke` | n/a |

**Needs Justin's go**
1. Migration 275 on `elkdonis_dev` (production DB; additive, one table).
2. The arts-collective rebuild and restart at the end. `cms-ui`, `studio`, `lms` and `actions` changes ship to the other apps only with their own next builds; all are additive and inert there.
3. Wording: answer wave 1 (at least `gain-space` and `org-email`, the only cards people see in this slice) so a live dock shows approved text; until then live shows the generic card. Also the three missing atlas rows (`listing`, `org-offering`, `org-people`) and wording for `org` and for the dock's post Publish/Lead and channel moves.
4. The draft-wording rule: dev/preview or global admin. Alternative: admin only (Justin sees drafts on live, no one else, preview shows generic too).
5. A commit: nothing is committed without his say (and the tree has other sessions' work).

## 8. Open items and risks

- Surface saves (profile, details, org identity) go through their own routes, not necessarily `performAction`, so pushed completion does not fire for them. They settle through the status re-check on dock refetch/return (case 3), which is why the dock refetches on return and focus. Making those routes call the registry is the homogenising pass, not this slice.
- `studio` (2.2) is a frame step today; going to `/studio` loses the lesson's frame, so the Route card plus "Back to the trail" is its replacement. Studio's own Publish already hands back to a `next` (`StudioShell.tsx:536`); a later slice can pass the dock's `eac-step` as that return.
- The dock hides on `/learn` (`defaultHidden`); departures are never created from there, so no change.
- The surface popup layer and the dock tab both sit in the bottom-right; check z-index (`dock.css` uses 60) against the surface layer in the preview, and that the outline is not clipped by a scroll container.
- Anchor drift: a refactor can silently drop an attribute. `check-anchors` (hard failure in `check:registry`) is the guard; it greps source, it does not render.
- `listing`'s page-address input could not be located by grep (§3.2); resolve in S2.
- Out of scope, noted: runbooks and per-subject runs (P3; `run_id` is reserved), org subdomains and own-domain apps (P4), the MCP cards (P6), tutorials (D-18).
