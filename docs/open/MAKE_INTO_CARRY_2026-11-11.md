# Make into: carrying one piece into another kind (brief, 2026-11-11)

Design for the Studio's "Make into" step: from an existing piece (the source) a
person picks a target kind, confirms which parts carry over, and saves a linked
draft of that kind, which then opens in that kind's normal form. The carry-over
is one contract shared by the Studio page, the action registry and the MCP
assistant. Status 2026-11-11: design only. No code, migration or build.
Scope correction (developer, 2026-11-11, later): Make into is an intermediary
step; the first build carries plain fields only, and the source parser
(quotes, recording moments, pictures inside essays, transcripts) is for a later
session. Sections 2 and 3 keep the full design for that session. Mockups:
canvas https://claude.ai/artifact/5P199FztbfocRXX4kZkgoy, artboards M1
(confirmation page, interactive) and M2 (after saving); the Studio shell around
it is R1 on the same canvas.

Claim labels: **verified** = read in the code or queried on 2026-11-11 by the
session that wrote this brief; **reported** = from a read-only research pass the
same day, not re-read; **assumed** = not checked.

## 1. Decisions (developer, 2026-11-11)

- Studio makes one piece; Channel moves pieces over time. The Studio's left
  column has two tabs, "All pieces | This piece"; This piece is the form rail
  (Start from, Essentials, More, readiness). No Flow tab: a Board button in the
  top bar opens a right sheet with the piece's next weeks, next moves, Make into
  and Manage.
- Publish hands back to Channel: a confirmation with the planned Channel items
  and "Continue in Channel"; when the Studio was opened from Channel, Publish
  returns there. This reverses "No share or Channel step (by request)" in
  `packages/studio/src/forms/shell/AfterPublish.tsx:13` (verified).
- One save control: drafts save themselves; the save-state menu holds named
  versions. No Quick save or Save draft buttons.
- Make into is a confirmation page (M1), then "Save as draft" opens the new
  piece in its own kind's form. The family stays reachable as tabs over the
  workspace or in the rail's Linked group (M2 shows both; not yet chosen).
- The carry-over must be usable by the registry and the assistant, not only the
  Studio page.
- Answers to the open questions (developer, 2026-11-11):
  - The draft lands in the source's org; it can be changed afterwards with
    the form's Posting on chip.
  - Same source into the same kind twice: the confirm page says what was made
    before and offers Open it, or Make another.
  - Private media is carried ticked; Publish lists the private files and asks
    before going live (see section 4 for what Publish must then do).
  - The draft takes the target kind's default audience, not the source's.
  - "Made from" shows in the Studio and Channel only, for now. It is the start
    of crediting on the platform: choose link roles and data so they can later
    become public credits (who and what a piece came from).
  - After saving, the family shows in the rail's Linked group (M2 b), not as
    tabs.
  - Studio Focus hides the "This piece" column; the bar's "N to go" opens it as
    an overlay.
  - Recording moments may come from any of: a span marked while watching,
    transcript phrases selected, markers set live, or the whole recording.
    Deferred with the parser.

### Studio path without a save step (verified 2026-11-11)
Forms autosave a draft only after an edit and only once there is a title
(`packages/studio/src/forms/state.ts:385-400`, verified). So the Studio's
confirm page does not need "Save as draft": its primary button opens the target
form with the carried values applied (as `applyPreset` does,
`forms/state.ts:197`), and the draft is created on the first edit. Leaving
without editing creates nothing, as Writing already behaves
(`StudioShell.tsx:35-37`). The lineage link is written on that first save
(needs an `onSaved` hook on the form; `onPublished` exists,
`forms/contract.ts:294`, reported). The registry/MCP path still saves a draft
directly, since there is no form to type into.

## 2. Current state

### Representations a carry map could key on
- **Form Answers** (recommended). The four form kinds load into and save from
  `Answers` (`packages/studio/src/forms/contract.ts:238`, verified). Keys differ
  by kind: artwork uses `description`, `pictures`, `credits`; the others use
  cms-ui's `body`, `cover_image_url`, `location`, `host_user_id` (reported,
  `forms/adapters/artwork.ts:262-265`). Video is not a form kind (reels:
  `reel_projects`, `packages/services/src/reels.ts`).
- **cms-ui content fields** hold field specs, not values. `switchContentKind`
  (`packages/cms-ui/src/compose/content-fields.ts:894`, verified) already
  carries typed answers between meeting and series, including body to lede. It
  is the precedent for carry-over. `ContentKind` has no artwork (reported,
  `content-fields.ts:42`).
- **`@elkdonis/content` model** is a display summary: stores are only
  `thread | artwork` (`packages/content/src/model.ts:12`, verified), with title,
  excerpt, media and formatted meta; no body, place, people or price (reported).
  Use it for addressing (`contentKey`, `model.ts:224`, verified), not for carry.
- **Presets cannot carry content.** `PRESET_KEYS` never include title, body,
  dates or media (`packages/studio/src/forms/presets.ts:16`, verified). The seed
  must be applied like a preset (`applyPreset`, `forms/state.ts:197`, verified)
  but built by the carry planner.

### Save paths a server-side carry would call
- Writing: `createWritingPost({ authorId, … })` (`packages/services/src/writing.ts:440-462`,
  verified). It homes the piece in the personal org and lists it on the site org
  when the author is a member (comment at `writing.ts:442-445`, verified).
- Gathering: `saveMeetingContent` (`packages/services/src/meeting-content.ts:475`),
  edit rule `mayChange` (`:249`) (verified).
- Offering: `saveServiceFormAction` reads the cookie session (`viewerId()`) and
  gates inside the app action (`apps/arts-collective/src/lib/service-form-actions.ts:142-151`,
  verified). Same for artwork (`apps/arts-collective/src/lib/artwork-form-actions.ts:179-186`,
  verified). Both need a save function that takes an explicit viewer id before
  the registry or MCP can create those drafts.

### Registry, assistant, Studio URL
- Registry `perform` keeps `subjectId` only for `thread`-scoped entries
  (`packages/actions/src/server/run.ts:405-407`, verified), and `loadThread`
  accepts only kind `post` (`run.ts:74`, verified). A `make-into` entry is
  therefore person-scoped and takes the source as input.
- The MCP tools are read-only (slice 1); writes come later through
  `performAction` with `via: 'mcp'` (`packages/mcp/src/server/tools.ts:1-13`,
  verified).
- `/studio` reads only `org, id, kind, focus, preset`
  (`apps/arts-collective/src/app/studio/page.tsx:107-111`, reported). No `from=`
  or `return=` parameter exists.
- `CREATE_KINDS` has no service/offering entry (`packages/content/src/registry.ts:70-77`,
  verified).

### Lineage
- `studio_items.kind` is limited to `recording | file | reel | piece`; a piece
  needs `thread_id` (migration 248, `248_studio_items.sql:23`, verified). Link
  `role` is free text and part of the key (`:52-54`, verified), so a
  `made_from` link needs no migration.
- `ensurePieceItem` exists (`packages/services/src/studio-items.ts:134`, verified);
  writes are best-effort (reported, `:13-17`).
- `getStudioTrail` filters by `owner_id` only (`studio-items.ts:248-261`,
  verified): a co-guide of the org does not see another person's lineage.
- `thread_gathers.relation` allows `produced` (migration 131,
  `131_thread_gathers.sql:72`, verified); unlike `studio_item_links` it can show
  on public pages.

### Parts inside a source
- Exists: `sanitizeRichText`, paragraph and excerpt helpers, essay doc nodes
  (`pullQuote`, `essayImage`, `gallery`, `threadCard`); `body_doc` wins over
  `body` on save (reported, `forms/adapters/post-studio.ts:33-36`).
- Transcripts exist only inside a reel project: `reel_transcripts.project_id`
  is `NOT NULL` (migration 229, `229_reel_transcripts.sql:8`, verified).
- Missing (reported): extracting images or quotes from an essay doc or HTML;
  HTML to essay doc; "marked moments" in a recording; transcripts for a
  recording outside a reel; reel edits accept only the person's own storage
  (`reels.ts:219-235`), so an org's recording cannot become a clip; artwork
  credits only the seller; writing has no people field.

## 3. Proposed contract

Pure half, a new subpath `@elkdonis/studio/forms/carry` (no React, no kind
schema imports; `forms/index.ts` exports React and the kinds' schemas import
section components, reported):

```ts
type CarryKind = 'writing' | 'gathering' | 'artwork' | 'service' | 'video';
interface CarryAsset { url: string; alt?: string | null; private: boolean }  // parseMediaPath()?.isPrivate ?? true
interface CarrySource {
  key: string; kind: CarryKind; orgId: string; visibility: string | null; title: string;
  answers: Answers;
  extras: {
    images: CarryAsset[];
    people: { userId: string; role: string; name: string }[];
    quotes: { text: string; at?: number }[];
    links: { url: string; label: string; membersOnly: boolean }[];
  };
}
interface CarryPart { id: string; label: string; from: string; to: string; default: boolean; preview: string; warn?: string; seed: Partial<Answers> }
interface CarryPlan { source: { key: string; kind: CarryKind; title: string }; target: CarryKind; parts: CarryPart[]; stays: string[] }

function planCarry(src: CarrySource, to: CarryKind): CarryPlan;
function seedOf(plan: CarryPlan, chosen: readonly string[]): Answers;  // composes body_doc for writing
```

Server half, supplied by the host app (pattern: `SiteBuilderAdapter`, reported
`packages/actions/src/server/site-adapter.ts:17-31`), because the Answers to
record converters live in `@elkdonis/studio`, which neither services nor actions
depend on (reported):

```ts
interface CarryAdapter {
  load(userId: string, key: string): Promise<CarrySource | null>;          // null: missing or not editable
  saveDraft(userId: string, kind: CarryKind, orgId: string, seed: Answers):
    Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}
function applyCarry(
  ctx: { userId: string; carry: CarryAdapter },
  input: { from: string; to: CarryKind; parts?: string[] }
): Promise<
  | { ok: true; draftId: string; kind: CarryKind; orgId: string; studioHref: string; linked: boolean; warnings: string[] }
  | { ok: false; error: string; code?: 'forbidden' | 'unknown' | 'input' }
>;
```

`applyCarry` loads the source, re-plans, seeds only the chosen part ids, saves
the draft, then writes lineage (`ensurePieceItem` for both, link `made_from`).

### Registry entry `make-into`
- Scope `person`, area `content`, runnable, agent exposure `draft`.
  `performs`: "Saves a draft of the chosen kind, linked to its source. Nothing
  is published, copied or shared."
- Input: `from` matching `^(thread|artwork|reel):[A-Za-z0-9_-]{1,64}$`; `to`
  from a closed list (default `writing`); `parts`, optional, at most 40 ids.
- Allowed when the source is editable by the person (gathering: `mayChange`;
  artwork: ownership) and the person may create the target there (offering:
  owner or guide of a non-personal org; artwork: their own store).
- Refusals: registry codes `auth`, `input`, `forbidden`, `failed`; `unknown`
  for a missing source; entry-level messages for an unsupported pair, nothing
  chosen, or target validation.

### Callers
- **Studio:** server page `/studio/make?from=&to=` runs `planCarry` through the
  adapter for the signed-in user and renders M1. Its primary button ("Open as
  an offering") opens the target form with the seed applied; the form's
  autosave creates the draft (section 1, "Studio path without a save step").
  ~~"Save as draft" calls `runAction('make-into', …)`, then redirects~~
  (struck 2026-11-11: not needed in the Studio; kept for the assistant).
- **Assistant:** a read tool `make_into_plan` now; the write goes through
  `performAction` with `via: 'mcp'` when MCP writes land.
- **Hand-off URLs** carry ids only, never content: form kinds
  `/studio?kind=gathering|artwork-form|service-form|video&id=<draft>&org=&from=<key>`;
  writing `/studio?id=&org=`. `from` only draws "Made from …" from lineage.

## 4. Rules

- Resolve the user from the session (`ActorContext`), never from input: the
  registry and the Studio page both run as the signed-in person.
- Take the draft's org from the source row, not from the request, until the
  developer answers question 1: a request-supplied org could place drafts in an
  org the person does not run.
- Send only part ids from the browser and re-plan on the server: a sent seed
  could carry content the person may not read.
- Carry media by reference, never copy files: copying could move a `Private/`
  file to a public path. Classify each path with `parseMediaPath`
  (`packages/services/src/media-authz.ts:59`, verified); treat an unparsed path as
  private.
- At Publish, list every carried private file and make the person choose,
  per file, a public copy or removal: a `Private/` path is not served to
  anonymous visitors, so a public piece that references one shows a broken
  picture. The only public-copy step today is `publishReel` (reported,
  `reels.ts:745-757`); pictures need an equivalent.
- Take the draft's audience from the target kind's default, not the source
  (developer, 2026-11-11); show the source's audience on the confirm page so a
  members-only source is not widened unnoticed.
- Leave a meeting's document link and `meeting_url` unticked by default: the
  document link may be writable (assumed) and the call link is for attendees.
- Do not let Make into publish anything: the draft goes through the target
  kind's own form and Publish.

## 5. Artwork lineage migration (outline, not written)

Add `studio_items.artwork_id uuid REFERENCES artwork(id) ON DELETE CASCADE`;
replace `studio_items_kind_check` (add `artwork`) and `studio_items_check` (add
`kind = 'artwork' AND artwork_id IS NOT NULL`); partial unique index on
`artwork_id WHERE kind = 'artwork'`; `org_id` from `artwork.org_id`; RLS
unchanged; map `artwork` to a stage in `STAGE_OF` (`studio-items.ts:28`). Take
the number with `/new-migration` when it is written.

## 6. Phases

1. Gathering to writing, writing to gathering, gathering to offering and back,
   plain fields only: title, description/body, place, hosts, cover picture.
   cms-ui keys and `switchContentKind`; no migration. The Studio path needs no
   viewer-id save (the form saves); the registry path needs one for offerings.
   Parser work (quotes, moments, images inside essay docs) is not in this phase.
2. Pairs with artwork: the migration in section 5, a viewer-id artwork save,
   image extraction from essay docs and HTML.
3. Video pairs: a model for recording moments, transcripts outside reel
   projects, org recording paths in reel edits.

Each phase also needs: the `/studio/make` page, the registry entry, the
`make_into_plan` read tool, the "Made from" line, and the Linked group or family
tabs in the rail (whichever the developer picks from M2).

## 7. Open items

Answered 2026-11-11 (section 1): draft org, making twice, private media,
audience, where "made from" shows, family display, Focus, recording moments.

Still open:
1. One `made_from` link per draft, or one per carried part? Decide together
   with the credits design, since per-part roles (`carry:pictures`) are closer
   to credits.
2. Should `reel:` become a content key beside `thread:` and `artwork:`?
   Needed only for video pairs (phase 3).
3. Gathering with Repeats: the form pauses autosave while Repeats is on, and a
   series draft is rebuilt on each save, so its id changes (reported by the
   form-design session from `meeting-content.ts` and the forms PLAN §13). The
   single save control must show a Save button while autosave is paused, and
   the lineage link must follow the new id or point at the series.
4. Channel's meeting links still open `/studio?kind=meeting`, the old tab, not
   `gathering` (reported, `apps/arts-collective/src/lib/channel/load.ts:829-844`).
5. Text size (developer, 2026-11-11: per person, Standard / Large / Largest,
   on every form and in the Studio). The shell owns the store and the Aa
   control; the form body only responds to `data-text-size`. A cookie, as the
   forum's `forum_size` (`packages/forum-ui/src/routes.tsx:114-135`, verified),
   is remembered per site, not per person across sites. Per person on every
   site needs a server-side preference (migration) or the SSO broker passing
   it. Decided (developer, 2026-11-11): per site for now, by cookie; across
   sites later.
6. "Make it a series" (same piece changes kind, `switchContentKind`) is a
   separate pass, planned with the form-design session; it is not Make into
   (a new linked piece).

## 8. Studio ↔ Channel links and the Board sheet (2026-11-11)

Deployed 2026-11-11 15:13 EST: arts-collective rebuilt (build
`N1Q0VWipnWA7FAam9XW5t`; backup of the previous build `ZFGlcI7N1QbUIzhK58iho`
at `~/eac-backups/next/arts-collective-20261111-1511.tgz`) with the 9 GiB cap
for the build, restarted, cap back to 5 GiB. Verified through the edge: `/` 200,
`/studio` and `/channel` 307 to login signed out, the served CSS and JS chunks
contain the sheet's rules and strings, `scripts/tenant-smoke.sh` 9/9. The build
also shipped other sessions' uncommitted work (media-authz, nextcloud, upload
route, lms, direct-edit `presets`, forms Ledger theme files). Not yet used
signed in on the live site.

~~Source only; arts-collective runs a production build, so none of this is live
until it is rebuilt.~~ (struck 2026-11-11: deployed, above) Type checks 2026-11-11: `@elkdonis/utils`, `@elkdonis/studio`
(admin container) and `arts-collective` (throwaway `eac-dev` container) pass with
0 errors. Not rendered or clicked through.

- `HostLinks.channelHref?(o: ChannelLinkRequest)` (`packages/utils/src/host.ts`):
  a piece's board in Channel, `{ store: 'thread' | 'artwork', id, org }`.
- `StudioFrameApi.next` and `setPiece` (`packages/studio/src/frame.tsx`); type
  `StudioPieceRef`.
- `StudioLinks.channelHref` (`packages/studio/src/types.ts`), set by the
  arts-collective `StudioApp` (`channelPieceHref`:
  `/channel/piece/<store>/<id>[?org=]`, org omitted for the personal org).
- `/studio?next=` (`apps/arts-collective/src/app/studio/page.tsx`
  `channelNext`): kept only when it is a path under `/channel` (no `//`, no
  backslash, at most 512 characters), so it cannot redirect off the site.
- Studio bar: a Board link to the open item's board, in the writing room's
  focus bar, the full bar, and the bar of form kinds
  (`packages/studio/src/StudioShell.tsx`). Form kinds report their saved record
  through `setPiece` (`packages/studio/src/forms/focus.tsx`).
- Writing: after Publish a notice "Published. Continue in Channel →" (or "Back
  to Channel →" when `next` is set).
- Forms: `AfterPublish` gets "Continue in Channel" / "Back to Channel" as its
  primary action; View on site becomes secondary
  (`packages/studio/src/forms/shell/AfterPublish.tsx`).
- `channelStoreOf` (`packages/studio/src/forms/channel-link.ts`): gathering and
  post map to `thread`, artwork to `artwork`, offerings to nothing, because
  Channel's `THREAD_KINDS` has no `service`
  (`apps/arts-collective/src/lib/channel/load.ts:112`, verified).

Board right sheet (added later 2026-11-11, source only, not rebuilt):
- `packages/studio/src/board.tsx` `BoardSheet`: header (title, kind ·
  status), "Board · next 3 weeks" (lanes × weeks from Monday, chips by state),
  "Next for this piece" (the board's suggestions; each opens the piece's Plan
  tab in Channel, `/channel?piece=<key>&tab=plan`), "Where it has gone" (three
  newest), footer Open board · Queue (`?week=<Monday>`) · New post about this.
  Escape and ✕ close it; fixed on the right under the sticky bar, full width
  on a phone. Styles `.studio-board*` in `studio.css` on `--st-*` tokens.
- Contract `StudioBoardView` / `StudioBoardLoader` (`packages/studio/src/types.ts`);
  `StudioShellProps.loadBoard`; the bar's Board is a toggle when it is set, else
  the plain link. `StudioLinks.channelHomeHref` for the "not listed" state.
- Server side: `apps/arts-collective/src/lib/studio-board-action.ts`
  (`loadStudioBoardAction`: user from the session; the item must be among the
  pieces `loadChannelModel` lists for that person, so a sent id or org reaches
  nothing else) and the pure mapping `apps/arts-collective/src/lib/channel/studio-board.ts`
  over Channel's `channelPieceToDetail`, so the sheet and Channel's pop-up read
  the same model. It reads the whole channel to find one piece, as
  `/channel/piece` does.
- Verified 2026-11-11: type checks 0 errors (`@elkdonis/studio`,
  `arts-collective`); the mapping run read-only against one person's live
  Channel (73 pieces, weeks from Mon 9 Nov, lanes/suggestions/recent filled);
  the sheet rendered from that output with the real `studio.css` in headless
  Chrome (light, dark, 390 px, "not listed"), no console errors. Not verified:
  the bar toggle inside the running Studio, signed in (needs a rebuild or a
  dev preview with a test account). `channel_deliveries` had 0 rows, so the
  lanes showed only publish events, not planned deliveries.

Not built:
- ~~The Board right sheet (canvas R1).~~ Built later the same day (above).
  Make into and Manage are not in it: Make into is not built, and there are
  no per-kind manage links yet.
- Channel → Studio links do not pass `next=` yet (`load.ts:521`,
  `:828-847`); the Studio falls back to the piece's board.
- Offerings in Channel (`THREAD_KINDS` + `PieceKind`).
- Leaving the Studio by the Board link has no unsaved-changes guard; the same
  is true of the existing "←" hub link (no `beforeunload` in the package).
