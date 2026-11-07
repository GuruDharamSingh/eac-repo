# Specialist 2: subject cascade and live controls (2026-11-02)

Specification for what a node is about, how that reaches every block in a group on both resolver paths, what a live control may read and do, and how a preview stays off production. Worked examples are in section 13. Nothing in the tree was changed; no container, row or build was touched. Probes are in `/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team/probes-s2/`.

Labels: [V:run] executed in the probe folder against installed packages, [V:read] code read, [V:sql] read-only SQL on `elkdonis_dev`, [A] assumed, [U] unknown, with the run that settles it. Names are provisional until the synthesis.

## 0. Decisions

1. **The subject is a stored reference, never data.** `props.subject` on any node or on `root.props`, resolved by a pure pre-pass into per-node scopes, loaded once per distinct reference, and handed to resolvers and to `<Render>` through `metadata.$subjects`.
2. Pre-pass, not `parent` forwarding and not a wider `BlockResolvers`. Evidence in section 3.
3. `metadata.threadId` keeps working. A scoped node gets `threadId` rewritten for it, so `loadEvent` works unchanged inside a scoped box once its access check is added.
4. Every read goes through one loader in `@elkdonis/services` that takes the org from the deployment and applies `canViewThread`. Hidden, gone, draft, archived and other-org are one state to a visitor.
5. Reads never call `ensure*`. A week with no row reads as count 0 and an empty list. Writes materialise it.
6. `needs.subject.reads` is enforced: the adapter passes a client only the declared fields, so the right column's list is accurate and the HTML holds nothing else.
7. Write targets are data on the view (`act`), produced only at the published tier. The canvas has simulated actions, and preview views have no `act`, so a mistake in wiring has no address to call.
8. `TreeCanvas` draws through a portal on real hosts and through `createRoot` plus a per-node boundary on the test page. `mountTreePage` must be called outside a React lifecycle.
9. A write fence (`fetch`, XHR, beacon, form submit) is on for the whole life of an editor mount. The editor's own save passes through `fence.allow`.
10. No router stub. A control that needs a router and has none draws a labelled stand-in.
11. Page references record nothing on the thread.
12. First real-data host: sunjay. IFAC has no Puck page route.

Two findings the thesis did not have: Puck 0.23.0 runs a node's resolver `depth + 1` times, so sunjay's template runs `loadEvent` 13 times per page view (section 4.4); and `loadEvent` checks `status` only, so a stored reference would expose an ORGANIZATION thread (section 6.2). The second is not exploitable today, because `threadId` only comes from a route that already ran `mayRead`.

## 1. What was run

| Probe | Result |
|---|---|
| `t1-resolve.cjs`: installed Puck `resolveAllData`, nested document | A node at depth d resolves d+1 times. `parent` is the direct parent. A prop no field declares survives, and a resolved key sits beside it. |
| `t1` with `remember()` copied verbatim from `config.tsx:110-182` | Per-node narrowed metadata: typing in a heading runs 0, a neighbour's change runs 0, own subject change runs 1. The whole scope map as one key: an unrelated change re-ran the resolver. |
| `t2-portal.cjs`: React 19.1.0 with Next 16.1.6's real `useRouter` and `AppRouterContext`, in jsdom | `createRoot`: throws "expected app router to be mounted". Portal under the provider: works, draws synchronously, keeps state and mount across draws. Details in section 10. |
| `t3-walk.cjs` over the real `puck:event-detail` row | 5 event blocks at depths 1, 2, 2, 2, 1: 13 `loadEvent` runs. No stored `event` prop. |
| `t4.cjs`: real `bind.ts` and `model/richtext.ts`, bundled with esbuild | `sanitizeRich` keeps `{{title}}`. A hostile title is escaped after fill. Dotted tokens do not match. Details in section 8. |
| `t5-cache.cjs`: `React.cache` under the flight server vendored in Next | 13 calls after awaits in a server component render: 1 load, viewer 1 load. Its "outside a render" line ran inside the request's async context and says nothing. |
| `t6-proto.ts`: prototype of `scopeMap`, pre-pass and adapter, through real `resolveAllData` and real `cleanBoxDoc` | Grandchild inherits, own subject wins, 2 distinct keys gave 2 loads for 9 resolver runs. A legacy block still sees `metadata.threadId`. `cleanBoxDoc` drops `subject` on a `box` today and keeps it on a sealed block. Hostile references cleaned. |

Not run: anything in a real Next app, a real browser, or against real thread data. The first signed-in trial settles those.

## 2. Shapes

### 2.1 Where each piece lives

| Piece | Location | Reason |
|---|---|---|
| `SubjectRef`, `SubjectView`, `cleanSubject`, `subjectKey`, `scopeMap`, `pickView`, `subjectItem`, fixtures | `packages/utils/src/subject.ts`, new subpath `@elkdonis/utils/subject` | `utils` is source-exported and already a dependency of services and blocks (`packages/services/package.json:30`, `packages/blocks/package.json:35`). `services` cannot import `blocks` (blocks depends on services). |
| `prepareSubjects`, `loadSubjectView`, `subjectCandidates`, `subjectRelations` | `packages/services/src/subject.ts` | Next to `meeting-series.ts` and `thread-audience.ts`. One broken file fails every app's type check (`CLAUDE.md`), so it lands in a stone by itself. |
| `needs`, `actions`, `fixtures` on `BlockDef`, `contractOf` | `packages/blocks/src/types.ts`, `registry.ts` | `BlockDef` is data and server-safe. |
| Controls | `packages/blocks/src/live/` | No `next/*` import exists under `packages/blocks/src/blocks` (grep), so they bundle for the test page. |
| Adapter change | `packages/page-builder/src/config.tsx` | |
| Canvas runtime, fence | `packages/direct-edit/src/puck/`, `canvas/fence.ts` | `direct-edit` stays ignorant of blocks. It receives the contract as data and a `runtime` wrapper as a component. |
| Host routes | `liveRoutes(site)` in `@elkdonis/services` | Same factory form as `rsvpRoutes(site)` and `createGatherRoutes`. |

Cost: `direct-edit` gains one dependency line (`@elkdonis/utils`) and sunjay gains `@elkdonis/direct-edit` and `@elkdonis/fonts`, so one coordinated `docker compose run --rm install`.

### 2.2 The stored reference

```ts
/** Which occasion of a thread. Absent means "next" for anything with a time. */
export type SubjectPick =
  | "next"            // next occurrence, published week, or scheduled departure a visitor may see
  | "series"          // the series itself, with no time of its own
  | { n: number }     // a series week by series_sessions.number: survives a move (SeriesWeekPage.tsx:28-29)
  | { at: string }    // a recurring meeting's occurrence as an ISO instant: occurrences have no id (threads.md:55)
  | { dep: string };  // a tour departure, tour_departures.id

export type SubjectRef =
  | { k: "thread"; id: string; at?: SubjectPick }
  | { k: "next"; of: "upcoming" | "standing" | "presented"; feed?: string }
  | { k: "route" };   // "this page's own thread", from inside a box that names another

export function cleanSubject(v: unknown): SubjectRef | null;   // shape only; no org, no DB. t6 ran the prototype.
export function subjectKey(r: SubjectRef): string;             // "t:<id>@next", "t:<id>@n3", "next:upcoming"
```

Rules:
- No org in the reference. The org comes from the deployment on every read (`.claude/rules/areas/puck-blocks.md:29`). `cleanSubject` drops an `org` key; t6 confirmed.
- A `series_session` thread id is not stored. The picker offers weeks by number, because a week with no row has no thread to name, and the loader normalises a stored one through `metadata.seriesSession` (`meeting-series.ts:1345`) in case a hand-edited document holds one.
- Reserve `subject` and `live` in `RESERVED_PROP_NAMES` (`packages/blocks/src/registry.ts:78`). No block declares either (grep), and no node prop holds either [V:sql: 0 of 31 `puck:%` rows; the one `user_pages` hit is a `subject: null` column on an artwork row inside a resolved store payload, not a node prop].

### 2.3 The resolved view

```ts
export type SubjectShape = "one-off" | "recurring" | "series" | "week" | "tour" | "workshop";
export type SubjectState = "ok" | "none" | "hidden";
export type SubjectFacet = "core" | "body" | "rsvp" | "replies" | "attendees" | "hosts" | "materials" | "join";

export interface SubjectView {
  key: string;
  /** hidden: gone, archived, draft, other org or no access. A visitor cannot tell them apart. */
  state: SubjectState;
  /** Server clock, for a countdown's skew (art-auction live.client.tsx:14-16). */
  now: string;
  /** Canvas data: no polling, no `act`, no `join` (precedent: SAMPLE_NOW, live.client.tsx:18,29). */
  preview?: true;
  core?: SubjectCore;
  bodyHtml?: string;                 // sanitised
  rsvp?: SubjectRsvp;
  replies?: SubjectReplies;
  attendees?: Array<{ name: string; photoUrl: string | null }>;
  hosts?: Array<{ name: string; avatarUrl: string | null; href: string | null }>;
  materials?: Array<{ id: string; name: string; url: string; kind: string }>;
  /** Published tier only, and only past the gate. */
  join?: { url: string | null; details?: { meetingId?: string | null; passcode?: string | null; other?: string | null }; roomUrl?: string | null };
  /** Published tier only. See 9.2. */
  act?: SubjectAct;
}

export interface SubjectCore {
  threadId: string;                  // the week's parent series for shape "week"
  shape: SubjectShape;
  kind: string;
  title: string;                     // the week's title for shape "week"
  href: string | null;               // null when this host has no page for it
  excerpt: string | null;
  coverUrl: string | null;
  startsAt: string | null;           // ISO; a moved week's new time
  durationMinutes: number | null;
  timeZone: string | null;
  whenText: string | null;           // already formatted for display
  place: string | null;              // a link in `location` is not a place (data-event.ts:59-62)
  isOnline: boolean;
  cancelled: boolean;
  past: boolean;
  audience: "everyone" | "followers" | "members" | "guides" | "owners" | "author";   // storageToAudience
  hasRoom: boolean;
  calendarUrl: string | null;
  week?: { seriesId: string; seriesTitle: string; seriesHref: string | null; number: number; at: string; movedFrom: string | null };
  recurrence?: string | null;
}

export interface SubjectRsvp {
  open: boolean;
  closedBecause?: "off" | "deadline" | "cancelled" | "past" | "draft";
  count: number;
  limit: number | null;
  full: boolean;
  viewerGoing: boolean;
  signedIn: boolean;
  signInHref: string;
}

export interface SubjectReplies {
  count: number;
  items: Array<{ id: string; author: string; avatarUrl: string | null; html: string; at: string }>;   // display names only
  canPost: boolean;
  closedBecause?: "locked" | "no-target";
  talkHref?: string | null;          // series level: SERIES_FORUM_HREF, SeriesPage.tsx:42
  signInHref: string;
}

/** Editors-only endpoint. Never in a published page. */
export interface SubjectNote {
  reason: "draft" | "archived" | "gone" | "other-org" | "audience" | "feed-role" | "no-next" | "week-draft" | "week-unannounced" | "no-route";
  detail?: string;
}
```

### 2.4 Contract fields on `BlockDef`

```ts
export type SubjectField =
  | "title" | "kind" | "shape" | "href" | "excerpt" | "coverUrl" | "startsAt" | "durationMinutes" | "timeZone"
  | "whenText" | "place" | "isOnline" | "cancelled" | "past" | "audience" | "hasRoom" | "calendarUrl" | "week" | "recurrence"
  | "bodyHtml" | "rsvp" | "replies" | "attendees" | "hosts" | "materials" | "join";

export interface BlockNeeds {
  subject?: {
    /** What the right column lists. Enforced by pickView when `via` is "live". */
    reads: readonly SubjectField[];
    /** "live": the adapter fills prop `live`. "event" and others: a host resolver fills a named prop; reads are declared, not enforced. "context": a provider above it (elktours). */
    via: "live" | "event" | "series" | "context";
    /** Which shapes it can draw; the panel warns on others. Omitted: all. */
    shapes?: readonly SubjectShape[];
    /** With nothing in scope: follow the next upcoming (today's loadEvent behaviour) or draw empty. */
    whenNone: "next" | "empty";
  };
  /** Other sources, listed in the right column only: `[{ label: "This org's feed", prop: "limit" }]`. */
  other?: ReadonlyArray<{ label: string; prop?: string }>;
}

export type LiveActionId = "rsvp.set" | "rsvp.guest" | "reply.post" | "series.subscribe" | "room.create";

export interface BlockAction {
  id: LiveActionId;
  /** Said in the right column: "Says whether they're coming". */
  label: string;
  requires: "anyone" | "signed-in" | "editor";
  sideEffects?: ReadonlyArray<"mails-person" | "mails-host" | "creates-session" | "creates-room">;
}

export type SubjectStateId = "signed-out" | "coming" | "full" | "cancelled" | "past" | "none" | "hidden" | "moved" | "soon" | "started" | "empty" | "some" | "locked" | "no-room" | "not-allowed";

export interface BlockFixtures {
  /** The Try it menu lists the union over the selected group. A state patches the subject, so the whole group flips together. */
  states?: readonly SubjectStateId[];
  /** For blocks whose data is not a subject (a feed): resolved props by name. Never in defaultProps. */
  rows?: Readonly<Record<string, { label: string; props: Record<string, unknown> }>>;
}

// Added to BlockDef:
needs?: BlockNeeds;
/** Present, even empty, means ported: safe to let through in Try it. Absent on an interactive block means unported. */
actions?: readonly BlockAction[];
fixtures?: BlockFixtures;
```

`contractOf(blocks)` returns `{ slots, needs, actions, fixtures, samples }` by block id. It is server-safe, and it replaces `slotsOf` from `mount.ts:36`, which is in a `"use client"` file and cannot run on the server path. With no `fixtures` and a `sample()`, the row is derived: keys of `sample()` that are not declared props (`dataOf`). That gives the test page data for the existing `thread-feed`, `pt-*` and `au-*` blocks with no new entries, and removes the handover's "data blocks draw empty" (section 5 of the handover).

### 2.5 What a host supplies

```ts
export interface LiveRoutes {
  threadRsvp?: { url: string; style: "post-delete" | "status-body" };   // IFAC takes {threadId, status} at /api/hub/rsvp (hub/connectors.ts:142-144)
  guestRsvp?: string;        // /api/rsvp
  seriesRsvp?: string;       // /api/series/rsvp
  seriesComment?: string;    // /api/series/comment
  seriesSubscribe?: string;  // /api/series/subscribe
  reply?: string;            // /api/live/reply, from liveRoutes(site)
  base?: string;             // fourthwayBookreaders: "/books"
}

export interface LiveSite {
  orgId: string;
  getViewer(): Promise<{ userId: string; role: ThreadRole | null; canEdit: boolean; isMember: boolean; isAffiliate: boolean } | null>;
  isGlobalAdmin?(userId: string): Promise<boolean>;
  getForumViewer(): Promise<ForumViewer>;
  threadHref(t: { kind: string; slug: string; section: string | null }): string | null;
  seriesBase?: string;       // "/series" when series-site is mounted; absent means no pages for a series
  talkBase?: string | null;
  routes: LiveRoutes;
  timeZone?: string;
}
```

Route presence today [V:read, directory listing]: `/api/threads/:id/rsvp` on amrit-canada, arts-collective, elktours, fourthwayBookreaders, innergathering, sunjay; guest `/api/rsvp` on amrit-canada, elktours, innergathering, sunjay; series routes on ifac, sunjay. `art-auction/api/series` is a different thing and is not declared.

## 3. Cascade

### 3.1 Resolution order

For node N with a block that declares `needs.subject`:

| Step | Source | Example | Stored where | Notes |
|---|---|---|---|---|
| 1 | N's own `props.subject` | RSVP pointed at another meeting | on the node | `{k:"route"}` jumps to step 4 |
| 2 | Nearest ancestor's `props.subject`, through declared slots | a `box`, a `pt-band`, a `split-row` | on that node | Any node with a slot passes it down; sealed containers included |
| 3 | `root.props.subject` | a page about one thread | document root | |
| 4 | Route | `metadata.threadId` from `[feed]/[slug]/page.tsx:128-131` | not stored | Editor: a "drawn for" thread chosen in the panel, also not stored |
| 5 | `needs.subject.whenNone: "next"` | `{k:"next",of:"upcoming"}` | not stored | The panel says "Next upcoming (automatic)", with a way to pin it |
| 6 | Nothing | | | `live: null`; the block draws its empty state; the panel asks |

Steps 1 to 3 are explicit and beat the route, so a pin on a template is honoured. Step 4 beats step 5. A block that does not declare `needs.subject` ignores all of this.

### 3.2 Why a pre-pass

| Option | Finding | Decision |
|---|---|---|
| Extend `BlockResolvers` with `parent` and `root` | `parent` is one level [V:run]. `root` has no tree. A grandchild under `box > box > rsvp` cannot see it. | No |
| Forward down the tree: every slotted block resolves a `$scope` prop | Needs an adapter resolver on every container, puts a resolved key on every node, and Puck re-resolves a child only on the child's own change, so changing a box's subject leaves children stale on `remember` | No |
| Pre-pass: pure walk gives `scopes[nodeId]`, carried in `metadata` | Works on `resolveAllData`, `TreeCanvas` and plain components alike; no key on any node; independent of Puck's order; testable alone [V:run t6] | Yes |

```ts
export interface Scope { ref: SubjectRef | null; key: string | null; from: string /* node id | "root" | "route" | "auto" | "none" */; own: boolean }
export type Scopes = Record<string, Scope>;

/** Pure, parents first, nearest wins. The popup calls it on the full document, never on the subtree it shows,
 *  so a subject inherited from outside the popup is still right and the From row can name its source. */
export function scopeMap(doc: PuckDoc, slots: SlotMap, route: SubjectRef | null): Scopes;

export interface SubjectEnv { scopes: Scopes; views: Record<string, SubjectView>; }
```

### 3.3 `remember()` and the adapter

`remember` tracks metadata reads by key and compares by JSON (`config.tsx:158-182`). A resolver reading a whole map would re-run on any change anywhere [V:run t4]. So the adapter narrows before calling it, and the resolver sees one value that is about its own node [V:run t3]:

```ts
// packages/page-builder/src/config.tsx, replacing the call at :412
const SUBJECTS = "$subjects";
function scopedMeta(metadata: Resolved, id: string): Resolved {
  const env = metadata[SUBJECTS] as SubjectEnv | undefined;
  if (!env) return metadata;                        // every page and Puck's own editor today: no change
  const { [SUBJECTS]: _env, ...rest } = metadata;
  const scope = env.scopes[id];
  const view = scope?.key ? env.views[scope.key] ?? null : null;
  const out: Resolved = { ...rest, subject: view };
  if (scope?.ref?.k === "thread") out.threadId = view?.core?.threadId ?? scope.ref.id;
  else if (scope?.ref?.k === "next") delete out.threadId;
  return out;
}

// at :340: a block with needs.subject.via === "live" and no host resolver gets this one
const liveResolver = (def: BlockDef) => async (_p: Resolved, meta: Resolved) =>
  ({ live: pickView(meta.subject as SubjectView | null, def.needs!.subject!.reads) });
```

`BlockResolvers` keeps its signature (`config.tsx:68-73`), and `loadBlockData(id, props, ctx)` is unchanged (`block-data.ts:132`). Resolver key `live` is not a declared prop, satisfying `puck-blocks.md:47`. All view values are plain JSON with ISO dates, satisfying the same rule.

`remembered` at `config.tsx:121` is module-global on the server. `resolveAllData` always passes `trigger: "force"` (`dist/rsc.js:1032`), so `remember` never answers from it there [V:read], but each result, including per-viewer data, stays in that Map until overwritten. It is not served. Skip `remembered.set` on the server if the synthesis wants that closed; out of scope here.

## 4. Loading

### 4.1 Published path

```ts
// apps/sunjay/src/lib/puck/render.tsx:54-64
const viewer = await getViewer().catch(() => null);
const route = typeof opts.metadata?.threadId === "string" ? ({ k: "thread", id: opts.metadata.threadId } as const) : null;
const env = await prepareSubjects(page.data, liveSite, { contract: CONTRACT, route, tier: "published" });
const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
  orgId: siteConfig.orgId, slug, canEdit: Boolean(viewer?.canEdit), ...opts.metadata, $subjects: env,
});
return <Render config={serverPuckConfig} data={resolved as Data} metadata={{ $subjects: env }} />;
```

```ts
export async function prepareSubjects(doc: PuckDoc, site: LiveSite, o: {
  contract: Contract; route: SubjectRef | null; tier: "published" | "preview"; viewAs?: ViewerTier;
}): Promise<SubjectEnv> {
  const scopes = scopeMap(doc, o.contract.slots, o.route);
  const want = wantedFacets(doc, scopes, o.contract);     // also counts `words` nodes holding tokens as wanting "core"
  if (want.size === 0) return { scopes, views: {} };      // no contract block: no viewer query, no thread query
  const viewer = await site.getViewer();
  const views: Record<string, SubjectView> = {};
  await Promise.allSettled([...want].map(async ([key, { ref, facets }]) => {
    views[key] = await loadSubjectView(ref, facets, site, viewer, o).catch(() => hiddenView(key));
  }));
  return { scopes, views };
}
```

One load per distinct key, facets are the union across the group [V:run t6 with a stub loader]. A loader error draws the group empty and logs; it does not fail the page. The resolvers that follow are map reads, so the `depth + 1` runs in Puck 0.23 cost nothing.

### 4.2 Editor path

The canvas needs the same `SubjectEnv` from the browser. `DataProvider`, one of the three providers:

```ts
export interface DataProvider {
  views(req: Array<{ ref: SubjectRef; facets: SubjectFacet[] }>, as: ViewerTier): Promise<{ views: Record<string, SubjectView>; notes: Record<string, SubjectNote> }>;
  candidates(q: string, o?: { shapes?: SubjectShape[] }): Promise<SubjectCandidate[]>;
  weeks(seriesId: string): Promise<Array<{ n: number; at: string; title: string | null; state: "published" | "draft" | "cancelled" | "past" }>>;
  relations(ref: SubjectRef): Promise<SubjectRelations | null>;
  rows?(doc: PuckDoc): Promise<Record<string, Record<string, unknown>>>;   // legacy resolvers through resolveAllData, as CanvasEditor.tsx:44-46
}
```

- Real host: `GET /api/live/views?d=<base64url of refs and facets>&as=<tier>`, editors only, at most 20 references, org from the deployment. GET, so it passes the fence.
- Test page and lab: fixtures. No network.
- Memo: one `Map<key|facets|as, Promise<SubjectView>>` per mount, cleared by a Refresh control.
- `scopeMap` reruns synchronously on every structural edit; only a new key causes a fetch; `draw` runs again when it lands.

`/api/blocks/[id]/route.ts:26-34` calls `loadBlockData` with no `ctx`, so today a canvas cannot show a chosen thread on legacy blocks. Add `threadId` to `viaApi` (`config.client.ts:40-51`, reading the narrowed `meta.threadId`) and pass `{ threadId, preview: true }` from the route. `getThreadById` is already org-scoped (`apps/sunjay/src/lib/data.ts:303`).

### 4.3 Save path never stores resolved values

| Path | Holds resolved values? | Guard |
|---|---|---|
| Tree editor | No: `resolved` is kept apart from the doc (`mount.ts:23`, `TreeCanvas.tsx:84`) and `env` likewise | none needed |
| Puck editor on sunjay | Yes in state | `stripResolved` at `actions.ts:47`, driven by `RESOLVED_KEYS` |
| Puck editor on a host with a new `live-*` block | Yes in state | new: `savePage` (`page-builder/src/store.ts:78`) drops prop `live` and runs `cleanSubject` on `subject` for every node. One choke point, so a host cannot forget |

`cleanBoxDoc` rebuilds own nodes from a whitelist, so it needs three lines: `cleanOwn` (`puck-tree.ts:205-215`), sealed pass-through (`:197-200`), root (`:232-238`). Without them `subject` on a box is dropped today [V:run t6].

### 4.4 Cost

`resolveAllData` in 0.23.0 resolves a node once per ancestor plus once (`dist/rsc.js:937-962` recursion, then `:1038-1042` again) [V:run t1]. 0.24 lists a fix (survey section 7) [V:web, not run].

| | Today, sunjay `puck:event-detail` | With this |
|---|---|---|
| `loadEvent` runs per view | 13 [V:run t3] | 1 per distinct thread, see below |
| Queries per run | viewer (session, role), thread, terms, feeds, count, cycle, answer, materials, attendees (`data-event.ts:35-54`, `data.ts:306`) | same once |

Stone for sunjay, independent of everything else and worth doing first:

```ts
// apps/sunjay/src/lib/puck/data-event.ts
const loadBase = cache(async (threadId: string | null) => { /* viewer, thread, gate, the six queries, not props */ });
export async function loadEvent(ctx, props) {
  const b = await loadBase(typeof ctx.threadId === "string" && ctx.threadId ? ctx.threadId : null);
  /* roomAllowed from props.membersOnly and the projection, as now */
}
```

`cache` memoises inside an RSC render across awaits and `Promise.all` [V:run t5]. A route handler serves one block per request and does not need it. The `grep` for `cache(` in sunjay, IFAC and series-site found none (direction notes), so this is new.

| Facet | Queries | Source |
|---|---|---|
| core, thread | 1, plus 1 cycle status when dated | `threads` + `org_feeds` join; `getCycleStatus` |
| core, series or week | 5 | `getMeetingSeries` = `loadSeries`, `loadSessionRows`, then hosts, notes, counts in `buildSeries` (`meeting-series.ts:802-811`) |
| rsvp, thread | 2 | attendance (members + guests, cycle-aware), viewer's answer |
| rsvp, week | 1 | count comes with the series; `getSeriesRsvps` for the viewer |
| replies | 2 | `listReplies` (`forum.ts:754`); 0 when no topic exists |
| hosts | 1 | `hostCards` |
| attendees | 1, members only | |
| viewer | 2, once per page | session, `getOrgRole` |

**`withOrg` is not used on this path.** It is a transaction holding one connection, and the services here (`getMeetingSeries`, `listReplies`) use the global `db`, which `packages/db/src/tenant.ts:12-13` says stays unrestricted, so wrapping them would scope nothing. Scoping is by explicit `orgId` and the check in section 6.

## 5. Thread shapes

| Shape | Stored reference | Resolved | RSVP target | Comment target | No write: what happens |
|---|---|---|---|---|---|
| One-off `event`, `meeting` | `{k:"thread",id}` | `startsAt = scheduled_at` | `thread_rsvps` through `/api/threads/:id/rsvp`; guests `guest_submissions` through `/api/rsvp` where declared | replies on the thread, new `/api/live/reply` → `postReply` (`forum-write.ts:160`) | counts read; nothing created |
| Recurring `meeting` | `{k:"thread",id}` (next), pinned `{at:{at:iso}}` | occurrence computed in JS; cycle status from `thread_cycle_events` | the thread; counts and the viewer's answer are cut off per cycle (`data.ts:355-379`, `:420-438`). A pinned past occurrence: `rsvp.open=false, past` | the thread's replies. The per-occurrence `topic_thread_id` has writers only in series and reading circles (grep), so a plain meeting's replies are not per occurrence | nothing created; `meeting_occurrence_notes` is read only |
| Series level | `{k:"thread",id,at:"series"}` | series facts, `startsAt` null, `week` absent | none: `rsvp.open=false`; `act.subscribe` later | none: `talkHref` to `/forum` (`SeriesPage.tsx:42`, TODO E5) | nothing |
| Series week, next | `{k:"thread",id,at:"next"}` (default for kind `series`) | `sessions.find(!isPast && isPublished)` (`series-site/lib/series.ts:114-116`); `core.title` is the week's | `/api/series/rsvp` with `seriesId` + `week.at`; `ensureSeriesSession` runs in the write (`meeting-series.ts:1424`), and it mails the person and the host (`routes/rsvp.ts:49`) | `/api/series/comment`, `ensureSeriesSessionTopic` in the write (`routes/comment.ts:28`) | `topicThreadId` null: list empty, count 0, no thread made |
| Series week, pinned | `{at:{n}}` | `getMeetingSeriesWeek` by stored number (`:818-830`) | same, using the week's current `at` | same | same |
| Moved week | same `{at:{n}}`, reference untouched | `startsAt` new, `week.movedFrom` set (`SeriesWeekPage.tsx:151-153`) | same | same | same |
| Tour | `{k:"thread",id}` (next), `{at:{dep}}` | next `scheduled` row of `tour_departures` | none: `rsvp.open=false`. `tour_bookings` with party size is a booking, and `live-rsvp` draws a link to `href`. The right column says so | none found | nothing |
| Workshop | `{k:"thread",id}` | `scheduled_at`; `threads.sessions` and `workshop_sessions` are not addressed in this round (`authoring.md:472`) | `thread_rsvps` when `is_rsvp_enabled`; paid `workshop_join_requests` is a link | thread replies | nothing |
| Follow the next | `{k:"next",of:"upcoming"\|"standing"\|"presented",feed?}` | `getUpcomingThreads(1)` SQL moved to services, `getStandingMeetingId`, `getPresentedSeriesId`; then as that thread's shape | per resolved shape | per resolved shape | nothing |
| Route | none, or `{k:"route"}` | `metadata.threadId`, then as its shape | per resolved shape | per resolved shape | nothing |

Series-like detection: `kind = 'series'`, or `kind IN ('meeting','event')` with `metadata ? 'series'` or the presented series id, recurring and published (`series-site/lib/series.ts:144-156`, `meeting-series.ts:77`). Only those use weeks.

### 5.1 Target state: who sees what

| Target | View for a visitor | Visitor sees | Editor in the canvas, default Seen as: Visitor |
|---|---|---|---|
| Published, allowed | ok | the block | the block |
| Draft thread | hidden | the block's empty state | empty state, note "Draft. Visitors see nothing here until it is published." Seen as: Editor draws it |
| Draft series | hidden, also to editors: `loadSeries` filters `status='published'` (`meeting-series.ts:607`) | empty state | note "Draft series. It cannot be previewed until published." |
| Archived | hidden | empty state | note, with Change |
| Deleted | hidden | empty state | "This thread no longer exists.", with Change |
| Another org's, not shared | hidden | empty state | "Not on this site.", with Change |
| ORGANIZATION or INVITE_ONLY | hidden for those not allowed, ok for those allowed | nothing, or the block | note "Followers and above" and the count of blocks in the group that draw nothing for visitors |
| Feed `min_role` the viewer lacks | hidden | nothing | note |
| One-off or occurrence cancelled | ok, `cancelled` | cancelled state: countdown shows the cancelled line; RSVP closed (`rsvp-panel.tsx:45-55`) | same |
| Week cancelled, announced (`isAnnouncedCancellation`) | ok, `cancelled` | as `SeriesWeekPage.tsx:149,182` | same |
| Week cancelled, never announced; week draft | hidden unless `canSeeDraftWeek` | empty state | note |
| `next` with nothing coming | none | "The next session will be announced here." wording (`series-top.tsx:376`) | same, note if a draft week exists |
| Pinned and past | ok, `past` | countdown `endedText`; RSVP hidden | same |

A visitor's HTML is the same for every hidden row, so a page does not reveal that a private thread exists.

## 6. Org scoping and access

### 6.1 The check

One place, `loadSubjectView` in `services/subject.ts`:

```ts
const [t] = await db`
  SELECT t.id, t.org_id, t.kind, t.status, t.visibility, t.min_role, t.author_id, t.section, t.metadata, ...,
         f.min_role AS feed_min_role
  FROM threads t
  LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
  WHERE t.id = ${id}
    AND (t.org_id = ${site.orgId}
         OR EXISTS (SELECT 1 FROM thread_orgs o WHERE o.thread_id = t.id AND o.org_id = ${site.orgId}))`;
if (!t) return hidden("gone");
const home = t.org_id === site.orgId;
const role = home ? viewer?.role ?? null : viewer ? await getOrgRole(viewer.userId, t.org_id) : null;
const asRole = capRole(role, o.viewAs);                 // a preview may lower a role, never raise it
if (!canViewThread({ visibility: t.visibility, minRole: t.min_role, authorId: t.author_id, status: t.status },
                   { userId: viewer?.userId ?? null, role: asRole, isGlobalAdmin })) return hidden(reasonOf(t));
if (!meetsMinRole(asRole, t.feed_min_role)) return hidden("feed-role");
```

| Column | How it applies | Citation |
|---|---|---|
| `org_id` | From the deployment. A request or document value is ignored | `puck-blocks.md:29`; `SeriesSite.orgId` pattern |
| `thread_orgs` | Same rule as RLS `tenant_read`. Reads allowed; `act` omitted because every RSVP route filters `t.org_id = ORG` (`rsvp/route.ts:63-65`). The picker does not offer them in the first round | survey section 5; 32 rows [V:sql] |
| `status` | `canViewThread`: unpublished is for the author and the org's editors | `thread-audience.ts:92` |
| `visibility` | `canViewThread`, with the real `min_role`. Sunjay's `mayRead` passes `minRole: null` (`data.ts:273`), which hides INVITE_ONLY from everyone but author and admin; the loader does not copy that | `thread-audience.ts:93-97`; distribution 58 PUBLIC, 22 ORGANIZATION, 8 INVITE_ONLY published [V:sql] |
| `min_role` | As above | 3 rows set [V:sql] |
| Feed `min_role` | Rule from art-auction: the forum gates by feed | `puck-blocks.md:51` |
| Series week thread | `ensureSeriesSession` always creates PUBLIC (`meeting-series.ts:1340`), so access is checked on the series, never on the week thread | |

### 6.2 Before any stored reference reaches a legacy block

`loadEvent` at `data-event.ts:41` allows `published || canEdit` with no visibility check. Today `threadId` only arrives from a route where `getThreadBySlug` already ran `mayRead` [V:read], so nothing leaks. With `scopedMeta` rewriting `threadId`, a stored reference would. Replace `:41` with `canViewThread`, in the same stone that turns on the rewrite.

### 6.3 Who may store a reference

Whoever may save the page. Save checks shape only, with no DB read. The read check is the authority, so a crafted reference to another org's thread draws nothing for everyone.

## 7. What reaches the HTML

Everything in `live` on an interactive block is in the flight payload, so it is in the page source whether or not the control draws it (`config.tsx:435-440`). That is why `pickView` enforces `reads`.

| Field | Signed out | Signed in, no role | Follower (`viewer`) | Member | Editor, published page | Editor in canvas, any Seen as |
|---|---|---|---|---|---|---|
| Thread allowed by `canViewThread`: title, kind, excerpt, cover, when, place, hosts | if PUBLIC | if PUBLIC | PUBLIC, ORGANIZATION | plus INVITE_ONLY by `min_role` | all | per Seen as, capped at their role |
| `bodyHtml` | same | same | same | same | same | same |
| `rsvp.count`, `limit`, `full` | yes | yes | yes | yes | yes | yes |
| `rsvp.viewerGoing` | false | own | own | own | own | false unless a fixture says otherwise |
| Attendee names | no | no | no | yes (`data-event.ts:53`) | yes | fixture names only |
| `replies.items` | display names | same | same | same | same | same, read as the capped role |
| `replies.canPost` | false | true | true | true | true | fixture |
| Meeting URL, Talk room URL, thread | no, unless the block's `membersOnly` is off (`data-event.ts:57`) | same | yes | yes | yes | no |
| Join link and details, series | no | no | yes (`canSeeMaterials`, `series-site/lib/series.ts:129-131`) | yes | yes | no |
| Materials, series | no | no | yes | yes | yes | names only |
| Materials, thread | yes, as `data-event.ts:93` does today | yes | yes | yes | yes | names only |
| `hasRoom` | yes | yes | yes | yes | yes | yes |
| `act` (write targets) | yes, so a press can start sign-in | yes | yes | yes | yes | no |
| `SubjectNote` | no | no | no | no | no | yes |
| Emails (guests, hosts, authors) | no | no | no | no | no | no |

Sunjay's coded thread page is a separate policy: it prints the Talk URL and meeting URL to anyone (`[feed]/[slug]/page.tsx:181-184,209-214`, with the comment that public rooms are joinable by link). This table describes blocks on the Puck path and does not change that page.

The last column is the rule that answers "editors see more than visitors in the canvas": they do not. The canvas never fetches join details, Talk URLs or names, even for an owner, so a screen share or a stored mistake has nothing to expose. The right column says "Join link: set (hidden here)" from `hasRoom` and `join` presence reported by the editors-only note. `Editors always get it` at `data-event.ts:23-25` stays true on the published page only; `ctx.preview` turns it off on the editor route.

## 8. Reading data

### 8.1 How `needs` sits with what exists

| Thing | Is | Relation |
|---|---|---|
| `PropDef.binds` (`types.ts:222`) | a string prop holding a record id; manual fields win over it | Stays for records (artwork, service). No `binds: "thread"`: a subject cascades and has a pick; `binds` does neither |
| `needs.subject` | block-level: which fields of the subject in scope it reads | New |
| `FieldSpec` (`bind.ts:14-21`) | a token's key, label, type, sample | `SUBJECT_FIELDS: FieldSpec[]` is its instance for a subject |
| `FEED_FIELDS` (`cards/catalog.ts:40-52`) | the same for a feed item | `SUBJECT_FIELDS` uses the same keys where the meaning is the same: `title`, `kind`, `when`, `place`, `excerpt`, `format`, `duration`, `cover`. Added: `host`, `week`, `series`, `going` |
| `fillTokens` (`bind.ts:51`) | fills from an `Item` of display strings | `subjectItem(view)` builds that `Item` |

### 8.2 Tokens in `words`

Yes, filled on the server, as `{{title}}`, not `{{event.title}}`. `TOKEN_RE` has no dot [V:run t4: `tokensIn("{{event.title}} {{title}}")` is `["title"]`], and a scoped box already says which event, so a namespace adds nothing. Hold `{{paper}}`-style style variables to CSS values; they are a separate channel.

Mechanism: `Words` reads `puck.metadata.$subjects`. Both renderers supply `puck.metadata` to a non-interactive block (`dist/rsc.js:730-732,777`; `TreeCanvas.tsx:87`), but `render.tsx:64` must start passing `metadata`.

```ts
// packages/direct-edit/src/puck/blocks.tsx, in Words (:85-100)
const clean = sanitizeRich(typeof html === "string" ? html : "", { list: true });
const filled = hasTokens(clean) ? fillTokens(clean, subjectItemFor(puck?.metadata, id), { rich: true }) : null;
const text = filled ? filled.text : clean;
if (filled && !filled.any && !editing) return null;   // bound to nothing: the node is not drawn
```

Order and escaping [V:run t4]: sanitise, then fill with `rich: true`. `</b><script>` as a title became `&lt;/b&gt;&lt;script&gt;…`; `{{when}} · {{place}}` with no place dropped the separator; `<img onerror>` in stored words was removed at sanitise. `Words` is not `interactive`, so no field reaches a client.

Pictures and links: `Picture` and `cleanOwn` use `safeSrc`, which rejects a token [V:run t4]. Change both to `cleanSrc` (`bind.ts:82`) on store and `safeSrc(fillTokens(...))` on render. A filled `javascript:` is then refused [V:run t4: `safeSrc` returned null]. Add `cleanHref` likewise.

Puck 0.24 `fieldTransforms` is not used: `TreeCanvas` is not Puck's renderer, so it would not apply in the editor, and it would make this depend on the upgrade.

### 8.3 Live atoms and Detach

Yes, this keeps data where Detach freezes it. `adopt.ts` copies text and reports buttons and forms as skipped (`:19,:83`). Two new hooks beside `part` and `existing` (`:21-33`):

```ts
bind?(el: HTMLElement): string | null;   // data-bind="title" on a words element or img: stores {{title}}, not the text
atom?(el: HTMLElement): PuckNode | null; // data-live-atom="live-rsvp": a fresh node of that block, sealed and live
```

A block adds those attributes in its own markup, once. Detaching `pt-event-header` then gives a box of words holding `{{title}}`, `{{excerpt}}` and a picture on `{{cover}}`, which still follow the thread, with the facts row frozen unless marked. If the detached node had its own `subject`, the new box gets it. Unmarked text freezes as it does today and is listed in the bar. Lists (materials, replies) cannot be tokens: mark them as atoms or they freeze.

## 9. Control model

### 9.1 First set

All `styling: "tokens"`, `memberSafe: true`, `dataDriven: true`, in `SHARED_BLOCKS`, ids frozen on first store.

| Block id | Derived from | `interactive` | `reads` | `actions` | Fixture states | Parts needed from Specialist 1 |
|---|---|---|---|---|---|---|
| `live-countdown` | `art-auction/.../countdown.tsx:6-23` for the tick, `live.client.tsx:73` for skew | yes, no fetch | `startsAt, past, cancelled, title` | `[]` | soon, started, cancelled, none | label, digits, unit, ended |
| `live-event` | `EventHeaderView` (`sunjay/blocks/event.client.tsx:30-92`) rewritten on `--blk-*` | no | `title, kind, excerpt, coverUrl, whenText, place, isOnline, hosts, cancelled, href, week, recurrence` | `[]` | cancelled, moved, none | cover, kicker, title, excerpt, facts, fact label, fact value, link |
| `live-rsvp` | see 9.3 | yes | `rsvp, cancelled, past, title, href, week` | `rsvp.set`, `rsvp.guest` | signed-out, coming, full, cancelled, past | heading, count, button, note, guest form |
| `live-discussion` | list `SeriesWeekPage.tsx:272-296`, form `week-comments.tsx`, optional polling `art-auction/discussion.client.tsx:54-79` | yes | `replies, title, href` | `reply.post` | empty, some, signed-out, locked | heading, item, who, body, form |
| `live-calendar` | `surface/ics.ts:40,73`; series URL `SeriesPage.tsx:250` | no | `calendarUrl, startsAt, durationMinutes, title, place` | `[]` | none, cancelled | link |
| `live-talk`, last | `TalkRoomView` (`event.client.tsx:121-232`) without `useRouter` | yes | `hasRoom, join, title` | `room.create` | no-room, not-allowed | heading, note, buttons, frame |

Timer: a countdown to the subject's `startsAt`, with props `source: "subject" | "fixed"` and `until`, following `au-countdown` (`auction-blocks.tsx:223-246`), as the Chief Engineer's default. `au-countdown` stays; it reads auction stats.

Six existing RSVP implementations stay until their hosts are next touched, per direction.

### 9.2 Actions are data at the published tier

```ts
export interface SubjectAct {
  rsvp?: { via: "thread"; url: string; style: "post-delete" | "status-body"; threadId: string }
       | { via: "series"; url: string; seriesId: string; at: string };
  guest?: { url: string; threadId: string; title: string };
  reply?: { via: "thread"; url: string; threadId: string } | { via: "series"; url: string; seriesId: string; at: string };
  subscribe?: { url: string; seriesId: string };
}

export interface LiveActions {
  rsvp?(going: boolean): Promise<{ ok: true; going: boolean; count?: number } | { ok: false; error: string; signIn?: boolean }>;
  guest?(input: { name: string; email: string; wantsReminder: boolean }): Promise<{ ok: boolean; error?: string }>;
  reply?(text: string): Promise<{ ok: boolean; error?: string }>;
  refresh?(): void;
}
```

Why data and not surface-style connectors: a connector is a function, and functions cannot cross into a client component from a server render (`config.tsx:428-434`). `RsvpResult` (`surface/types.ts:1310`) is the model for the result. The host supplies routes once as `LiveRoutes`, and the loader turns them into `act`, which plays the role of `connectors.rsvp` (`surface/types.ts:1365`) and of the `centerRoutes()` factory.

Runtime, one client module:

```ts
// packages/blocks/src/live/runtime.client.tsx
export const LiveRuntime = createContext<LiveRuntimeValue | null>(null);   // set only by a canvas

export function useLive(live: SubjectView | null | undefined) {
  const rt = useContext(LiveRuntime);
  const value = useLiveStore(live);                 // shared per key, 9.5
  if (rt) return { view: value, actions: rt.actionsFor(value), mode: rt.mode };
  if (!live || live.preview) return { view: value, actions: {}, mode: "published" as const };  // fails closed
  return { view: value, actions: realActions(live.act), mode: "published" as const };
}
```

`realActions` uses `fetch`. It does not import `next/navigation`. After a write that changes what the server would gate (subscribe unlocks join details), `refresh` comes from an optional `LiveRefreshBridge` a host mounts with `router.refresh`; absent that, `location.reload()`.

### 9.3 RSVP: one interface over two write paths

Behaviour from `rsvp-panel.tsx`, the byte-identical copy in amrit-canada, elktours and sunjay: the states cancelled (`:45-55`), full (`:43`), member toggle (`:57-80`), guest form and done (`:82-106`). Sync and sign-in trip from `series-rsvp.tsx`: `ANSWER_EVENT` (`:50-57`), kept intent (`:87-93`, `:116-124`). No `toast`, no `@elkdonis/primitives`, no `useRouter`.

| Viewer state | One-off, recurring | Series week |
|---|---|---|
| Signed out, host has guest route | guest form → `/api/rsvp` (`guest_submissions`) | not offered: owner's decision (`routes/rsvp.ts:15-16,46`) |
| Signed out, no guest route | link to `signInHref`, intent kept | link to `signInHref`, intent kept |
| Signed in | POST or DELETE `/api/threads/:id/rsvp` (`thread_rsvps`); `status-body` on IFAC | POST `/api/series/rsvp` `{seriesId, occurrenceAt, going}` |
| After | POST returns `count` (`api/threads/[id]/rsvp/route.ts:230`); DELETE returns only `attending` (`:245`), so −1 locally as `ThreadSurface.tsx:127-133` | `rsvpCount` in the response (`routes/rsvp.ts:51`) |
| Mail on a real yes | to the person and the thread's author (`route.ts:173-209`) | to the person and the week's host (`routes/rsvp.ts:18-21`) |

The intent uses a new key, `eac-live-intent`, with the same 15 minute expiry and the same reason for sessionStorage over the URL (`series-intent.ts:1-6`). A thread intent carries `threadId`.

### 9.4 A host without the routes

`routes.seriesRsvp` undeclared means `act.rsvp` is absent. `live-rsvp` then draws a link to `core.href` ("Say you're coming on its page"), or nothing when `href` is null too, as on innergathering for a series. The right column names the reason (`SubjectNote` "no-route"), so the author sees it while placing the block.

`liveRoutes(site)`, mounted once per host:

| Route | Gate | Purpose |
|---|---|---|
| `GET /api/live/views` | editor | section 4.2 |
| `GET /api/live/candidates` | editor | section 12.3 |
| `GET /api/live/relations` | editor | section 12.2 |
| `GET /api/live/replies` | runs the subject check as the viewer | polling and refresh after a post |
| `POST /api/live/reply` | signed in; subject check, then `postReply` | one-off and recurring comments, which have no route today outside the forum's form action (`forum-ui/actions.ts:147-153`, which answers with a redirect) |

### 9.5 Pieces updating each other

`useLiveStore`: per subject key, `useSyncExternalStore` over `{ rsvp, replies }`. A write updates the store, so every control on that key changes together, and a window event `eac:live` `{ key, rsvp?, replies? }` reaches other React trees.

Bridge: when `act.rsvp.via === "series"`, the control also dispatches and listens for `ifs:series-answer` (`series-intent.ts:59-67`) as a string, with no import, so a new control beside `SeriesRsvp` and `SeriesTop` stays in step.

In the canvas, the store lives in the runtime value, per mount, so simulated answers never touch a real store and Try it shows the coherence: press RSVP, and the count in another block in the group changes.

## 10. Canvas runtime

### 10.1 Portal

Tested behaviour, all [V:run t2, jsdom with installed React and Next code]:

| Case | Result |
|---|---|
| A. `createRoot`, block calls `useRouter` | throws `invariant expected app router to be mounted` |
| B. Portal rendered by a host component under `AppRouterContext` | no throw; `useRouter` returns the provider's value |
| B. `flushSync(() => setNode(...))` from outside a lifecycle | DOM updated before return, so `mount.ts:57-58`'s reason still holds |
| B. Second draw | same mount (mount count 1), control state kept |
| C. Click on a control | handler runs, `router.refresh` reached; the event also bubbled through the portal to the host page's React `onClick` |
| D. Capture handler at `document` stopping propagation | React handler does not run, in a portal as in a separate root |
| E. `draw` called inside `useEffect` or `useLayoutEffect` | warning "flushSync was called from inside a lifecycle method"; DOM still old right after, updated later |
| F. Per-node error boundary, no router | one node shows a stand-in, sibling still drawn |
| G. No boundary, separate root | whole canvas empty after one throw |

Consequences:

```ts
// packages/direct-edit/src/puck/mount.ts
export interface CanvasRoot { render(node: ReactNode): void; unmount(): void }

export function detachedRoot(host: HTMLElement): CanvasRoot {          // test page, lab
  const r = createRoot(host);
  return { render: (n) => flushSync(() => r.render(n)), unmount: () => setTimeout(() => r.unmount(), 0) };
}

// A host client component under the App Router renders this next to its host element.
export const CanvasOutlet = forwardRef<CanvasRoot, { host: HTMLElement | null }>(function CanvasOutlet({ host }, ref) {
  const [node, setNode] = useState<ReactNode>(null);
  useImperativeHandle(ref, () => ({ render: (n) => flushSync(() => setNode(n)), unmount: () => setNode(null) }), []);
  return host && node ? createPortal(<div style={{ display: "contents" }} onClick={stop} onPointerDown={stop}><Suspense fallback={null}>{node}</Suspense></div>, host) : null;
});
```

- `TreePageOptions` gains `canvasRoot?: CanvasRoot` (default `detachedRoot(host)`), `contract`, `data: DataProvider`, `runtime?: ComponentType<{ children }>`, `mode`.
- `mountTreePage` must be called outside a lifecycle. `CanvasEditor.tsx:34-46` already is, after its awaits; `EditPageButton.tsx:11-16` is, from a click after an import. State this in its doc comment.
- Render `CanvasOutlet` where nothing above it has click handlers, and keep the synthetic `stop` wrapper, because of case C. `EditPageButton` returns null once editing (`:23`); the outlet moves beside it.
- `NodeView` wraps each node in a boundary (`TreeCanvas.tsx:91`). A throw draws "This block runs only on the real site" with its name, and it stays selectable.
- Surface context takes the same path as router context [A: same React mechanism, not run]. Settled by `pt-standing` on sunjay in the first trial.
- A real Next app [U]: settled by the first signed-in trial.

### 10.2 Modes

| | Edit | Try it | Published |
|---|---|---|---|
| Renderer | `TreeCanvas` | `TreeCanvas` | `<Render>` |
| Clicks | captured (`clickthrough.ts:184-199`) | pass in nodes with `actions` declared; captured elsewhere | normal |
| Data | sample or preview views | same, plus state and Seen as menus | `prepareSubjects`, per viewer |
| Actions | none reachable | simulated, logged in the right column | real |
| Fence | on | on | none |
| Timers | tick | tick | tick |
| Polling | off when `view.preview` | off | on |
| Selection | yes | held | none |
| Links in live nodes | captured | captured and logged: "Would open /series/x/3" | normal |

Real or sample is a second axis on Edit and Try it, chosen by the provider: test page and lab have sample only; a real host defaults to real views at preview tier with a "Sample" switch.

### 10.3 Try it through the capture handlers

`isUi` at `clickthrough.ts:19` is checked before `held` at `:191-193`, and every handler returns early on it without `preventDefault`. So one selector and one attribute are enough:

```ts
const isUi = (t: Element | null) => !!t?.closest?.("[data-de-menu],[data-de-ui],[data-de-live],[contenteditable='true']");
```

`NodeMark` (`TreeCanvas.tsx:59-74`) sets `first.dataset.deLive = ""` when `mode === "try"` and the block's contract has `actions` defined, and removes it otherwise. Entering Try it calls `ct.hold(true)`, so everything unmarked stays inert by the existing `:193` branch [V:run t2 D for the pass and the capture]. The `keydown` handler returns early while held (`:253`), so the shell owns Esc to leave Try it. A surface a control opens is modal and stacks above, and owns Esc while open.

Puck's own `previewMode: "interactive"` swaps the canvas to a plain render of the data (`dist/index.js:16336`). That is not copied: this editor keeps the marks and the selection across the mode change, and it must keep unported controls inert, which a plain render would not.

### 10.4 The test page

No router, no server, no database. What must work there, with fixtures: a group that coheres, the From row, reads, writes and relations in the right column, state and Seen as menus, Try it with simulated RSVP and comments, count sync across blocks, the fence log, the picker over fixture threads. `dataOf(sample())` draws existing data blocks. A block that needs a router draws the stand-in through its boundary (case F), with a label saying so, so no router is stubbed. `harness/test.ts:19` adds the `live-*` blocks to its config.

## 11. Write fence

### 11.1 What guarantees it

| Way to reach production from a preview | Stopped by | Status |
|---|---|---|
| Ported control's action | Simulated provider; and preview views have no `act` to address | spec; fail-closed in `useLive` |
| Unported control, click | Capture in Edit; not marked `data-de-live` in Try it | [V:run t2 D] |
| Unported control, mount effect or timer: `series-rsvp.tsx:87-93`, `series-top.tsx:234-262` (need a kept intent or `?welcome=1`) | Fence | Prototype not run in a browser |
| Server action from an unported control, e.g. `createEventRoomAction` | Fence: Next's call goes through global `fetch` at call time (`server-action-reducer.js:68`) | [V:read] |
| Native form submit | Fence's capture `submit` listener | spec |
| `navigator.sendBeacon` | Fence | spec |
| Talk iframe | `talkUrl` null in preview, so no frame (`event.client.tsx:149`); `live-talk` draws a stand-in | spec |
| `ensure*` on a read | Loader never calls one. Grep of series pages, `lib/puck`, block routes found none on read paths; `ensureRoom` is only in the `"use server"` file | [V:read] |
| A library that cached `fetch` at module load | Not covered | [U]: log unblocked writes in a browser run on a page with every block |
| GET with side effects | Not covered; clicks are captured, so it needs an effect. None seen, not fully audited | [U] |

### 11.2 Fence

```ts
// packages/direct-edit/src/canvas/fence.ts, plain DOM
export interface FenceHit { at: number; via: "fetch" | "xhr" | "beacon" | "form"; method: string; url: string }
export interface WriteFence { allow<T>(fn: () => Promise<T>): Promise<T>; hits(): FenceHit[]; dispose(): void }

export function installWriteFence(o: { report(h: FenceHit): void; pass?: RegExp[] }): WriteFence;
```

- Patches `window.fetch`, `XMLHttpRequest.prototype.send`, `navigator.sendBeacon`, and adds a capture `submit` listener. Non-GET, non-HEAD is refused with `TypeError("Writes are off while editing")`, the same failure a network error gives, so `rsvp-panel.tsx:75-77` and its peers show their normal message.
- Installed by `mountTreePage`, on for its whole life, removed by `dispose`. Pass-list: `/^\/api\/auth\//` so session refresh keeps working, `/^\/api\/pulse/` for the analytics beacon.
- `allow` wraps the editor's own `onSave`, `choosePicture` and `onRestore`. While it runs, only same-origin writes pass. A stray effect firing in that window could pass [A: negligible, recorded here].
- Hits show in the right column: "This block tried to write: POST /api/x. Stopped."

Why on in Edit as well as Try it: an unported control mounts and runs its effects in Edit, and that is the case the capture cannot see. With the portal those controls no longer throw on mount, which is what kept them from running at all until now.

### 11.3 Unported controls

Drawn live through the portal with the fence on, not replaced by a stand-in, because their look is what the author is fitting (handover section 8). Held inert by capture. The right column says "Runs on the published page; try it there." On the test page they fall to the boundary stand-in.

### 11.4 Secrets

Omit, do not hide. The published tier applies today's gates unchanged: `data-event.ts:57`, `SeriesPage.tsx:115-116`, `SeriesWeekPage.tsx:89-91`. The preview tier omits `join` and `act` for every role. A fixture never contains a real URL. The canvas's `resolved` and `env` are never saved (section 4.3), so nothing reaches a document.

## 12. Coherence and relations

### 12.1 Rules

| Operation | Rule | Reason |
|---|---|---|
| Group, no child has a subject | Box has none; children inherit from above | Nothing to decide |
| Group, one distinct explicit subject among children | Lift to the box, clear from children. Bar: "This group is about X." | The developer's "automatically cohere" |
| Group, children disagree | Box has none, each keeps its own. Panel: "2 subjects in this group", action "Make all about X" | Silent choice would change what a control writes to |
| Add a block into a scoped box | No own subject: inherits | |
| Move a block with its own subject into a scoped box | Keeps it. Panel: "Own: Y. The box is about X." with "Use the box's" | Explicit wins; visible |
| Move a block out, inherited subject changes | Effective subject follows the new place. Bar: "Now about Z (was X)." with "Keep X", which pins it | A move must not silently repoint an RSVP. Compare `scopeMap` before and after in `structural()` for moved ids whose block has `needs` |
| Duplicate a group | Subject copied, new ids. Both groups address one thread, and the store keeps their counts in step | Re-point with the picker |
| Unwrap a box holding a subject | Push it to direct children that have none and `needs.subject` | Meaning is kept |
| Detach a sealed node holding a subject | New box takes it (section 8.3) | |
| Delete a group | Reference goes with it. The thread is untouched | |
| Open in the popup | `scopeMap` on the full document; editing the root node writes to that node only | |
| Restore a dog-ear | Subject not touched; dog-ears hold looks, not meaning (section 18) | |

`part` nodes are not scoped: the page draws them.

### 12.2 Right column

Section "Data" at the top of Properties for any node with `needs.subject` or a `subject`, in plain-DOM `panel.ts`, with `data-sync` placeholders for soft render (handover section 7). Wording is for artists. Layout is to be read from `harness/reference/rowlayer4.png`, whose From group is two-column rows with a `+`.

```
About     # Running the Script                   Change
Which     Next session · Session 4, Thu 13 Nov   ▾
From      # <section> "Next session"             +
Reads     title · next time · time zone
Can do    Say they're coming → a yes on Session 4. Mails them and the host. Signed-in only.
Seen by   Everyone. Join link: signed-in followers and up (set, hidden here).
On page   Countdown, Event card, RSVP, Discussion
Now       3 coming · 2 comments
Try it    Seen as ▾   State ▾
```

Code tab: `fromGroups` (`tree-editor.ts:280-295`) gains a row `subject  "Running the Script" · next` at the nearest ancestor with one, using `code.sheet.from` (`panel.ts:98,516-521`). The existing `+` (`data-adopt-prop`) copies the reference onto this node. `:287` limits groups to own nodes; a subject row applies to any ancestor.

| Row | Source | Queries |
|---|---|---|
| About, Which, Seen by | view `core` | 0 extra |
| From | `scopes[id].from` | 0 |
| Reads | `needs.subject.reads` + `SUBJECT_FIELD_LABELS` | 0 |
| Can do | `actions` + `core.shape` + `act` kind reported by the note | 0 |
| On page | doc walk over `scopes` | 0 |
| Now | `rsvp`, `replies` facets if a block in the group reads them; otherwise `relations` | 0, or 1-2 on open |
| Elsewhere, on click | `SELECT key FROM site_config WHERE org_id = $1 AND key LIKE 'puck:%' AND value::text LIKE '%' \|\| $id \|\| '%'` | 1; 31 rows total [V:sql] |

```ts
export interface SubjectRelations { rsvp: { members: number; guests: number } | null; replies: { count: number } | null; pages?: string[]; note?: SubjectNote }
```

### 12.3 Picker

No `ThreadPicker` exists. `SurfaceGatherConnectors.candidates` takes a host thread id and `gather-route.ts:247-258` includes wiki pages from any org, so it is the model, not the code. New `subjectCandidates(orgId, q, { shapes })`: same `ILIKE` escaping, `t.org_id = $1`, kinds `event, meeting, series, workshop, reading_group, tour`, `status IN ('published','draft')`, excluding `series_session`, ordered by next time then activity, limit 12. Empty `q` offers upcoming, then the standing and presented ones first.

Drawn in plain DOM in the panel. Choosing a series or a recurring meeting opens the second row: Next | The series itself | a week (`weeks(seriesId)`) or a date. A private choice warns before it is set: "Only followers see this. Visitors will see nothing here."

### 12.4 Nothing recorded on the thread

A page's reference writes no row. `thread_gathers` is for what a thread holds and shows in its gather band; saving a page should not change a thread. Reverse lookup is the on-click query above. The cost is that archiving a thread does not warn about pages using it; the page's editor sees the note next time it is opened. If the developer wants a warning at archive, the same query serves.

## 13. Worked examples

### 13.1 The group: countdown, card, RSVP, discussion lower down

Stored in `site_config` `puck:running-the-script`, org `sunjay`. Real series id [V:sql]. `overlay` is Specialist 1's; shown only to mark where it sits.

```json
{
  "root": { "props": { "title": "Running the Script" } },
  "content": [
    {
      "type": "box",
      "props": {
        "id": "box-next",
        "tag": "section",
        "label": "Next session",
        "subject": { "k": "thread", "id": "bl0whFnG6dS_7J9NvvLyS", "at": "next" },
        "look": { "layout": "stack", "gap": 24 },
        "items": [
          { "type": "live-countdown", "props": { "id": "c1", "label": "Starts in", "source": "subject", "until": "", "endedText": "We are meeting now",
                                                 "overlay": { "$owner": "specialist-1" } } },
          { "type": "live-event", "props": { "id": "e1", "showCover": true, "showFacts": true } },
          { "type": "live-rsvp", "props": { "id": "r1", "label": "I'm coming", "showCount": true } },
          { "type": "words", "props": { "id": "w1", "tag": "h2", "html": "Talk about <b>{{title}}</b>" } },
          { "type": "live-discussion", "props": { "id": "d1", "heading": "Conversation", "limit": 20, "refresh": 0 } }
        ]
      }
    }
  ]
}
```

No resolved value appears. Author naming another thread: change `subject` on `box-next` to `{ "k": "thread", "id": "u_Nc_PUtWLPnSRjxAjWu2" }`; one block pointing elsewhere gets its own `subject`. Automatic cohering: no `subject` at all on a thread route, or on an ordinary page with `whenNone: "next"`.

Editor:
1. Adding `live-rsvp` into the box needs no choice. `scopeMap` gives it `t:bl0…@next`, from `box-next`.
2. Right column: About Running the Script; Which Session 4; From `<section>` "Next session"; Reads; Can do "a yes on Session 4".
3. Try it: State Full changes the RSVP and the count in the group; press "I'm coming": store updates, log says "Would write a yes on Session 4. Would mail you and the host." No request leaves the page, and the fence log is empty.
4. Popup on `c1`: re-rooted on that node, `scopeMap` still on the full document, so From still names `box-next`.
5. Re-style and dog-ear: writes `overlay` only (Specialist 1). `subject`, block definition and other pages are untouched.

Published, signed out:
1. `prepareSubjects`: one key, facets `core, rsvp, replies`; `getMeetingSeries` then `listReplies`. No `ensure*`.
2. `live-countdown` gets only `{startsAt, past, cancelled, title}`, `live-rsvp` only its fields plus `act`. No join details, no names.
3. `w1` server-renders `Talk about <b>Session 4 title</b>`, escaped.
4. Press "I'm coming": no guest path on a series, so a sign-in link with intent kept; on return the control sends POST `/api/series/rsvp`, and `ensureSeriesSession` makes the week in the write.

### 13.2 Sunjay `puck:event-detail`, unchanged

Stored row is unchanged: 11 nodes, no `subject`, no `event` [V:run t3, V:sql].

| Step | Today | After |
|---|---|---|
| Route | `renderPuckPage("event-detail", { template: true, metadata: { threadId } })` | same (`[feed]/[slug]/page.tsx:128-131`) |
| Pre-pass | none | `scopes[*]` all route; no block has `via:"live"`, so `want` is empty and no query runs |
| Resolver | `loadEvent(ctx, props)` with `ctx.threadId` | same value, as `scopedMeta` leaves route refs alone |
| Output | `event` prop | same |
| Change | | `loadEvent` memoised (section 4.4), access check (section 6.2) |

Declaring the contract on these blocks changes the right column and nothing published: `needs: { subject: { via: "event", whenNone: "next", reads: [...] } }`, `actions` left undefined on `pt-event-rsvp` and `pt-talk-room` until they move to the action model. In the editor, "Drawn for" picks a thread for the template, sent as `threadId` on `/api/blocks/*` with `preview: true`.

Verify: signed-out HTML of a thread with `detailPage` on is identical before and after, as was done for series-site on 2026-11-02. Which threads have the flag: query at run time.

### 13.3 Countdown, RSVP and discussion on an IFAC series week

```json
{ "type": "box", "props": { "id": "wk3", "tag": "section",
    "subject": { "k": "thread", "id": "Gnove0JPbyLYG4_QCTt-V", "at": { "n": 3 } },
    "items": [
      { "type": "live-countdown", "props": { "id": "c", "source": "subject" } },
      { "type": "live-rsvp", "props": { "id": "r" } },
      { "type": "live-discussion", "props": { "id": "d" } }
    ] } }
```

Weeks 1 to 4 of `art-for-non-professionals` are materialised and published, all `slot_at = starts_at` [V:sql]. `{n:3}` keeps naming the same week after a move. RSVP is `/api/series/rsvp`, comments `/api/series/comment`, both on IFAC (`apps/ifac/src/app/api/series`). Week 3 going past: countdown shows `endedText`, RSVP hides, discussion stays. A week with no row (later numbers): `getMeetingSeriesWeek` resolves by rule; count 0, list empty, nothing created.

IFAC cannot store this today: only `apps/ifac/src/components/person-view.tsx` imports Puck (grep), and `puck:%` rows for IFAC are none [V:sql]. It needs a Puck page route and a config. The IFAC series pages themselves stay code, and `/series/<slug>/<n>` is unchanged.

### 13.4 One-off meeting

`{ "k": "thread", "id": "<id>" }`. `core.shape` one-off, `startsAt = scheduled_at`. RSVP `/api/threads/:id/rsvp`, guests `/api/rsvp` where declared. Comments `/api/live/reply`. After `scheduled_at`: `past`, RSVP closed. `is_rsvp_enabled = false`: `rsvp.open = false, closedBecause: "off"`; the control draws nothing and the right column says "RSVP is off for this thread."

`board-meeting` (`0CHoeVEugFC-Hu4xY7Nkt`, inner_group, ORGANIZATION) placed on a public page: signed out, nothing in the HTML. Follower: draws. Picker warned. Same reference on sunjay: `t.org_id` mismatch, no `thread_orgs` row: hidden for everyone.

### 13.5 Recurring meeting

`ritual-theatre-lab` (`u_Nc_PUtWLPnSRjxAjWu2`, sunjay, WEEKLY) [V:sql]: `{ "k": "thread", "id": "u_Nc_PUtWLPnSRjxAjWu2" }`. Each request computes the next occurrence. RSVP on the thread, cycle-scoped: last cycle's yes does not count (`data.ts:416-438`). `getCycleStatus` cancelled gives `cancelled: true` for this occurrence; next cycle it clears. Countdown jumps to the next occurrence when this one ends. Comments on the thread, across occurrences (section 5). Pin to one date: `{at:{at:"2026-11-12T…Z"}}`, compared in JS, not SQL (`threads.md:55`).

### 13.6 A monolith made editable: `pt-event-header`

No rewrite. Data side only; parts are Specialist 1's.

```ts
export const eventHeader = defineBlock({
  ...base, id: "pt-event-header", /* unchanged */
  needs: { subject: { via: "event", whenNone: "next", reads: ["title","kind","excerpt","startsAt","timeZone","durationMinutes","place","isOnline","hosts","coverUrl","cancelled"] } },
  actions: [],
  fixtures: { states: ["cancelled", "none"] },
}, EventHeaderView, sample);
```

`actions: []` because it has a `Link` and no write, so Try it may pass it, and the link is captured and logged. Markup gains `data-bind="title"` at `event.client.tsx:68`, `data-bind="excerpt"` at `:74`, `data-bind="cover"` at `:88`. Ladder result: moves and options work now; parts from Specialist 1; live atoms and Detach keep title, excerpt and cover following the thread (section 8.3).

Elktours: `TourMain` reads from a provider (`tour/context.tsx:16`), so `via: "context"`, with `reads` declared for the right column. No work in held paths (`ELKTOURS_CONVERGENCE_2026-11-02.md:6-7`). Tour subject is `{k:"route"}` there.

## 14. Series pieces and the first host

### 14.1 Which pieces become blocks with IFAC's markup unchanged

Method: extract the JSX into a named component, have the page call it with the same props, compare signed-out HTML as on 2026-11-02. Blocks live in `@elkdonis/series-site/blocks`, not `SHARED_BLOCKS`: their CSS is `.ifs` plus `site.css` (`README.md`), and only IFAC and sunjay mount it. `via: "series"`, with a host resolver on `getMeetingSeries` under `cache`.

| Piece | Code | Block? | Note |
|---|---|---|---|
| Cover | `cover-media.tsx` | yes | no client code |
| About left side | `SeriesPage.tsx:141-190` | yes | extract `SeriesAbout`; still passed as `SeriesTop.about` |
| Session rows | `session-rows.tsx`; `SeriesPage.tsx:267-283` | yes | `SeriesRsvp` island stays unported, held in canvas |
| Rota | `SeriesPage.tsx:286-325` | yes | no client code |
| Stage | `event-stage.tsx`, `lib/stage.ts` | yes | client, plain slide data |
| Week: when | `SeriesWeekPage.tsx:142-155` | yes | |
| Week: host | `SeriesWeekPage.tsx:226-249` | yes | |
| Week: previous and next | `SeriesWeekPage.tsx:251-268` | yes | |
| Week: conversation list | `SeriesWeekPage.tsx:272-294` | yes | form `week-comments.tsx:12` has `useRouter`; portal handles it, unported |
| Week: RSVP side | `SeriesWeekPage.tsx:181-224` | later | holds join details and sign-in; gating must not move by accident |
| `SeriesTop` | `series-top.tsx`, 419 lines | no, this round | one client state over attendance, subscribe, share, sign-in, two dialogs; `useRouter` at `:117`. Splitting it is its own work with its own HTML compare |
| Series and week pages | | no | stay code pages (direction 10) |

### 14.2 First real-data host: sunjay

| Need | Sunjay | innergathering | IFAC |
|---|---|---|---|
| Puck pages and resolver paths | yes, both | yes | no page route |
| Tree editor wired | no: add dependency | yes | no |
| Thread RSVP, guest, series routes | all | no series routes | series only; hub RSVP |
| Series, recurring data | `running-the-script`, `ritual-theatre-lab` [V:sql] | recurring only | yes |
| `SurfaceProvider` in layout | yes, root (survey) | yes | `/hub`, `/center` only |
| Existing template to protect | `puck:event-detail` | landing tree (unsaved) | none |

Sequence: the developer's innergathering rebuild comes first for the engine's first signed-in run (handover section 5). Then sunjay carries the first subject path. Each stone reaches production only through a build the developer runs.

## 15. Failure modes

| Case | Published | Canvas | Mechanism |
|---|---|---|---|
| Thread archived or deleted | block empty state; `words` with tokens not drawn; box and its look stay | note with Change | `hidden`; `Words` `!any` |
| No permission | same HTML as deleted | note names the audience | `canViewThread` |
| Private thread on a public page | nothing for those not allowed, block for those allowed | warning at pick, count of blocks affected | same |
| Another org's id in a crafted document | nothing for anyone | "Not on this site." | org in the query |
| Loader throws | group empty, logged, page renders | "Could not read this thread. Refresh." | `allSettled`, `.catch(hiddenView)` |
| Stale dog-ear after a block changes | no data in it, so no stale data | Specialist 1's concern for parts; `needs` growth is picked up at render | `subject` and `live` are outside `overlay` |
| Block removed from the catalogue | `<Render>` drops it (`authoring.md:165`) | "Unknown block" (`TreeCanvas.tsx:81`) | existing |
| Control throws in the canvas | n/a | that node shows the stand-in | boundary |
| Control throws on a published page | Next error handling, as for any client component; not changed | | |
| RSVP at capacity between view and press | route returns 409 with "This is at capacity"; control shows it | simulated by fixture `full` | `checkRsvpEligibility` (`thread-rsvp.ts:52-56`) |
| Sign-in expired mid-press | 401 → "Sign in again", as `series-top.tsx:163` | n/a | |
| Host without the route | link to `href`, or nothing | note "no-route" | `act` absent |
| Week moved after a reference was stored | `{n}` follows the move | `movedFrom` shown | `getMeetingSeriesWeek` |
| Week number never existing | none-state | note | `getMeetingSeriesWeek` null |
| Series schedule changed, pinned `{at}` no longer an occurrence | none-state | note | `isSeriesOccurrence` |
| Editor saves while views are loading | doc saved, views are not in it | | kept apart |
| Fence refuses a control's write | | control's normal error, log entry | `TypeError` |
| Puck's own editor opens a document holding `subject` | | `subject` kept; `live-*` draw "not connected" since no `$subjects` | [A: `resolveAllData` keeps it, V:run; Puck's editor state not run. Open a moved document in `/studio/<slug>`, as the handover did] |

## 16. Verification

Each stone is hand-tested on the private test page where it can be.

| Stone | Check | How |
|---|---|---|
| Pure: `cleanSubject`, `scopeMap`, `pickView` | hostile refs, nearest wins, pick drops undeclared fields | `harness` driver with no DOM; t6 is the start |
| `loadEvent` memo and gate | same signed-out HTML; one load | edge curl before and after; temporary counter in dev preview, not production |
| Group on the test page | group flips states together; From row; RSVP in one block moves count in another; no request | developer by hand; `drive` script asserting no network |
| Portal | `pt-standing`, `pt-event-rsvp`, `Link` draw; no throw | first signed-in trial; console log |
| Fence | a harness button that POSTs on mount is refused and logged; Save still saves | `drive` against `--network none` chrome (`runall.sh`) |
| Secrets | signed-out HTML has no `talkUrl`, `meetingUrl`, `passcode`, Talk token | `curl -sk --resolve <host>:30022:127.0.0.1 … \| grep -c`, across thread with room, series with join details |
| Canvas tier | `/api/live/views` as an owner has no `join`, no `act` | browser network tab in the trial; needs the developer, as test accounts were refused |
| Private on public | a page referencing an ORGANIZATION thread draws nothing signed out | edge curl |
| Cross-org | a document referencing another org's id | edge curl |
| No materialisation on read | `series_sessions` row count unchanged after viewing a page for an unmaterialised week | read-only SQL before and after |
| Tokens | `sanitizeRichText` is not involved; `sanitizeRich` then fill | t4 extended; `.claude/rules/03-verification.md` |
| Series blocks | IFAC signed-out HTML identical | as 2026-11-02 |

## 17. Decided not to do

- No `withOrg` on the read path (section 4.4).
- No `Date` or function in `metadata` or views: JSON only.
- No `parent` use; `BlockResolvers` is unchanged.
- No per-occurrence comment thread for plain recurring meetings. No writer exists, and adding one is a data-model decision.
- No RSVP on series level, tours or paid workshops. Those have other write models.
- No `thread_orgs` in the picker in the first round, and no writes on shared threads.
- No save-time org check. Read time is the authority, and save stays free of thread queries.
- No record on the thread (section 12.4).
- No migration. Everything fits `site_config` and existing tables.
- No router stub.
- No `{{event.title}}` namespace, no `fieldTransforms`.
- No sandboxed iframe for controls.
- No conversion of the six RSVP implementations, `au-countdown`, `au-discussion`, or the Silex embed catalogue's `rsvp` and `countdown`.
- No Subscribe or Talk room control in the first stones.
- `act`-less "real actions in the lab" against `elkdonis_scratch` is left to the lab's own spec.

## 18. Needed from others, and open items

From Specialist 1:
- **Name collision: `store-frame` already declares a prop named `overlay` (`packages/blocks/src/blocks/store-frame.tsx:59`).** Adding `overlay` to `RESERVED_PROP_NAMES` would throw at module load. Rename the node prop or the block's prop; no stored row holds either [V:sql: 0 rows with `"overlay":`].
- `overlay` holds no data references. A dog-ear restores looks, not `subject`. If a dog-ear should remember which thread it was made for, record it as display text only.
- "Tokens" in the thesis's overlay means style tokens; this report's tokens are `{{data}}`. Name them apart in the panel.
- Parts on `live-*`: the table in 9.1 lists what each needs. Controls will put `data-part` on those elements and use `--blk-*`.
- Overlay must apply to `interactive` blocks, which have `puck` stripped (`config.tsx:435-440`).
- Option groups for `source`, `until`, `showCount`, and so on on `PropDef`.

From the Team Lead: `mountTreePage` gains `canvasRoot`, `contract`, `data`, `runtime`, `mode`; chrome-in-a-container work is unaffected. `CanvasOutlet` must sit in the popup host as well.

Questions for the developer, through the senior advisor:
1. Guests on the new RSVP: default yes where `/api/rsvp` exists (four hosts); series stays sign-in only, per the owner's decision of 2026-10-08.
2. Week page attendee faces show to everyone today (`SeriesWeekPage.tsx:76,189-196`), while names on threads are members only. Default for `live-rsvp`: members only, no faces for visitors. Their call if the faces should follow the series page.

Unknown, with the run that settles it:
- Portal under a real App Router, surfaces included: first signed-in trial.
- Whether any client library cached `fetch` before the fence: browser run with all blocks, logging.
- Puck's editor keeping `subject` through its own state: open a document in `/studio/<slug>`.
- Puck 0.24's single-resolve fix: settled at that stone; this design does not depend on it.
- The new `/api/live/*` routes on one-app arts-collective, where the org comes from the host: `LiveSite` is built per request, so it should hold [A].

## Doc corrections noticed (not applied)

- Survey section 5 says recurring comments use `meeting_occurrence_notes.topic_thread_id`. Writers of that column are series and reading-circle code only (grep), so a plain recurring meeting has none in practice.
