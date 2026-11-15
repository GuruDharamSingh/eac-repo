# D: Make into, every kind (2026-11-15, system32-fc)

## 1. Kinds Studio opens as a new draft (`/studio?kind=<id>`)
| id | label | where |
|---|---|---|
| writing | Writing / Essay | packages/studio/src/kinds.ts:9 (built in, no href) |
| video | Video | kinds.ts:11; ext packages/reels/src/editor/index.ts:20; StudioApp.tsx:98 |
| post | Social posts | kinds.ts:13; ext packages/studio/src/post/index.ts:11; StudioApp.tsx:99 |
| recording | Recordings (capture tool, hidden from New) | kinds.ts:16; recording/index.ts:11; StudioApp.tsx:154 |
| wordart | Word art | kinds.ts:18; wordart/index.ts:11; StudioApp.tsx:155 |
| meeting | Meetings (publication form) | kinds.ts:22; formExtension StudioApp.tsx:100 |
| artwork-form | Artwork | kinds.ts:24; formExtension StudioApp.tsx:119 |
| service-form | Offerings | kinds.ts:25; formExtension StudioApp.tsx:137 |
| create | Create library (not a draft) | createExtension, StudioApp.tsx:97 |
Not openable (ready:false, kinds.ts:19,26-28): artwork (old), workshop, service, question.
The Board sheet's own "Make into" (StudioShell.tsx:147 MAKE_INTO_KINDS) offers writing, video, meeting, artwork-form, service-form.

## 2. What Studio has for form to form today
- Board sheet "Make into" (board.tsx:179, StudioShell.tsx:1038-1049): switches kind and opens a blank new piece. Nothing carries over (board.tsx:35 says so).
- AfterPublish (packages/studio-forms/src/forms/shell/AfterPublish.tsx): copy link, Continue in Channel, Make another. No make-into.
- Canvas "Turn into" (packages/studio-forms/src/canvas/Canvas.tsx:381) is block-level only (selection to quote/aside/heading).
- `from=` is NOT read by /studio (page.tsx searchParams has no `from`) nor by any form. /studio/make passes it and it is ignored. Only existing carry mechanism: `applyPreset` (packages/studio-forms/src/forms/state.ts:201) and `switchContentKind` (cms-ui content-fields.ts:894, meeting<->series).

## 3. New targets (makeIntoFor), most likely first
| source type | targets |
|---|---|
| writing | Social post, Artwork, Video clip, Meeting, Offering, Word art |
| meeting / event / workshop / series | Reminder post, Next meeting, Essay, Video clip, Offering, Word art |
| artwork | Social post, Essay, Video clip, Offering, Meeting, Word art |
| product | Social post, Artwork, Essay, Video clip, Offering, Word art |
| video | Social post, Essay, Meeting, Word art |
| other | Social post, Essay, Video clip, Artwork, Meeting, Offering |
Recording is never offered (capture tool). Own kind omitted except Next meeting. Labels changed: Post -> Social post, Clip -> Video clip; new Offering (service-form), Word art.

## 4. Diff summary
- packages/content/src/summary/make-into.ts: header accurate; new consts OFFERING, WORDART, VIDEO; makeIntoFor rewritten. Signatures unchanged.
- apps/arts-collective/src/app/studio/make/page.tsx: TARGETS = post, writing, video, meeting, artwork-form, service-form, wordart, recording; header comment updated.
- Backups: *.bak-2026-11-15-makeinto beside each. Not built, not committed.
- Typecheck (before and after): content 0, studio 0, arts-collective 0, sunjay 0, katie-the-potter 0 errors.
- Caveat: wordart and the writing/video-as-target flows ignore `from` like the rest; the Studio page must still open `?kind=wordart` with no org/piece (it does, per kinds.ts href).

## 5. Carry-over proposal
Fields by target (source thread/artwork row, plain fields only):
- post: title (headline), excerpt/body first 280 chars, cover or first picture, link to the source's public URL. Reminder post: meeting title, date/time, place, join link.
- writing: title, excerpt as lede, body (video: transcript if present), cover.
- meeting / Next meeting: title, body to description, cover, hosts, location, audience; Next meeting adds date = source + series cadence (else blank).
- artwork-form: title, description (from body/excerpt), pictures, credits (from hosts/author).
- service-form: title, description, cover/pictures, hosts as providers; price blank.
- video: title, pictures as stills, recording/clip ref if the source is a video.
- wordart: title text only.
Hook location: preferred is a `from=<store:id>` seed read in the Studio page (server: load the source once with the same loader as studio-summary-action) and passed to the form extension as an `initialSeed: Answers` applied through `applyPreset`-style reducer in useFormState (state.ts:201; draft is created on first edit per MAKE_INTO_CARRY). A per-pair carry map (source Answers key -> target key) lives in packages/studio-forms next to the adapters; the M1 parts screen is a later opt-in layer on top. Effort/lane: seed hook + map for post/writing/artwork/meeting = M, lane fc (page.tsx) + forms owner (state.ts); service/video/wordart seeds = S each after that; parts screen M1 = L, fc. Lineage link on first save needs an onSaved hook (contract.ts:294 has onPublished only) = S/M, forms owner.
Cell click to form: the site Channel's grid/queue cell should link makeIntoHref(makeBase, from, <top target of makeIntoFor(type)>, org) directly (first entry = default), with the full list in a "more" menu, rather than opening the summary. That is a Channel change in packages/channel/src/site and apps/*/channel: S, lane a2. It lands on /studio/make, which redirects straight to the form, so it is already one hop; it only becomes useful once the seed above exists.

## 6. Open questions for Justin
1. Should a cell click on Channel go straight to the first target (Reminder post for meetings, Social post for writing), or show the target list first?
2. Is Word art a real make-into target (title text only) or should it stay a tool, not offered?
3. Next meeting: carry the same date plus the series cadence, or leave the date blank?


## 7. Carry-over built (2026-11-15)

`/studio/make?from=...&to=meeting|artwork-form|service-form` now fills the new form from the source piece. The form opens with the preset applied and a "From “title”" entry in Start from; nothing is saved until the person edits.

### Files changed
- `apps/arts-collective/src/lib/make-into-preset.ts` (new, 'use server'): `loadMakeIntoPresetAction(from, to, orgId)` builds the one `FormPreset` (id `from:<key>`, source `item`) from the source.
- `apps/arts-collective/src/app/studio/page.tsx`: reads and validates `from` (same rule as make/page.tsx: <= 80 chars, `parseContentKey`), keeps it in the login `next=` query, passes `makeFrom` to StudioApp, and sets `initialPreset` to `from:<key>` when `preset` is absent.
- `apps/arts-collective/src/components/studio/StudioApp.tsx`: new optional `makeFrom` prop; `presets:` on the meeting, artwork-form and service-form `formExtension`s (added only; `makeFrom` added to the memo deps).
- `packages/studio-forms/src/forms/shell/FormShell.tsx`: preset effect now depends on `presets`, so a preset that loads after mount is applied (the old mount-only effect spent its one try before async presets arrived). Dated comment in the file.
- Backups: `~/eac-backups/2026-11-15-carry/<repo path>` (page.tsx, StudioApp.tsx, FormShell.tsx, this doc). None inside `src/`.

Note: `preset.kind` is the form schema id, so `artwork-form` maps to `artwork` and `service-form` to `service` (the brief said `kind: to`; `FormKindId` has no `-form` ids).

### Access rule
Signed-in user required (`getCurrentUser`), else null. No raw SQL. Layers, each through an existing loader that enforces access:
1. The piece must be in the viewer's own Channel model (`loadChannelModel`, as studio-summary-action.ts): title, excerpt, cover, kind. Not on their Channel = null.
2. Thread source: `loadMeetingAction` (services `loadMeetingContent`: author, or owner/guide of the org; only dated kinds meeting/event/workshop/series). Adds body, body_doc, hosts, where, RSVP numbers.
3. Artwork source: `loadArtworkFormAction` (`getArtworkForEdit`: the store's owner or member roll). Adds description, pictures, medium, size.
If layer 2 or 3 refuses, the preset still carries layer 1 only.

**Store not loadable safely:** non-meeting threads (writing, video, post). There is no existing viewer-checked loader for their body, so they carry title, excerpt (as the description, wrapped in a paragraph) and cover only.

### Field map per target (dates and price never carried)
- **meeting**, from a meeting/event thread you can edit ("Next meeting"): title, excerpt (Why), body, body_doc, cover_image_url, time_zone, duration_minutes, format, location, recurrence_pattern, recurrence_custom_rule, meeting_url, video_link, is_rsvp_enabled, attendee_limit, min_attendees, notify_on_min_attendees, visibility, create_talk_room, host_user_id, co_host_user_id, reminder_minutes_before. Left out: scheduled_at, start_time, recurrence_until, rsvp_deadline, feed_slug (the org's default stands).
- **meeting**, from anything else: title, excerpt (or first 280 chars of the body), body, cover_image_url.
- **artwork-form**: title, description (artwork body, else excerpt), pictures `[{url, alt}]` (artwork pictures, else the cover), and from an artwork: medium, height_cm, width_cm, depth_cm. Credits are not carried: the form's maker is the seller, and other credits have no column. Price, currency, year, edition and availability are left out.
- **service-form**: title, excerpt (Why), body (description), cover_image_url. Hosts as providers is not carried: the offering has no provider field (the author is the payee).

### Typecheck and checks
`check-types` (the commands from the brief, `error TS` lines minus booking): packages/studio-forms 0 errors, packages/studio 0 errors, apps/arts-collective 0 errors, after the change. The "before" run was not captured separately; the three packages report no errors after the edits, so nothing regressed. Rules check (`src/forms/rules/check.ts`, tsx in the admin container): 320 passed, 0 failed. No harness screenshot taken (skipped as not cheap).

### Post and writing: proposal (not built)
- **Post** (`postExtension`, `packages/studio/src/post/PostKind.tsx`): `newPost()` calls `actions.createPost(orgId)` which creates an empty social post. Seed: add an optional `seed?: { key: string }` plus `actions.seedPost?(key, orgId)` to `PostKindProps`; PostKind runs it once on first show when no `initialPostId`, and uses its result as the first `createPost` input (headline, 280-char excerpt or body, cover, public URL; for a meeting the reminder text with date/time/place/join link). The loader is a sibling of `loadMakeIntoPresetAction` with the same access layers (Channel piece plus `piece.href` for the link). Effort S/M. The reminder text needs the dated read from `loadMeetingAction`.
- **Writing** (StudioShell's built-in): `savePiece` creates the thread lazily on first edit via `actions.startPiece(orgId, title)` then `savePiece(id, patch)` (StudioShell.tsx ~505-520). Seed: a new `initialSeed?: StudioPatch` shell prop, loaded by page.tsx with the same loader (title, excerpt as lede, body, cover). StudioShell holds it as the `piece` draft when no `initialPieceId` is given, so the first edit's `startPiece` + `savePiece` carries it with `{...seed, ...patch}`. Needs a StudioShell owner to approve (shell file) and one decision: seed only the draft, or create the thread immediately (no; keep first-edit creation, as for forms). Effort M.

- fc review (2026-11-15 02:1x): access path OK (viewer's Channel model, then loadMeetingAction / loadArtworkFormAction). Removed recurrence_pattern and recurrence_custom_rule from the meeting carry: "Next meeting" is a one-off; copying a recurring source's pattern would start a second series. arts-collective check-types 0 after.
