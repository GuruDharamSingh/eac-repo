# One workshop page: "New workshop" asks four things, then you build it on the page (design, 2026-11-21)

Status: design only. Nothing was edited, built, installed or written to the database. Counts are the SELECT counts from `workshop-creation.md` (2026-11-20). Read-only code reads on eris, no browser run, so "exists" means "the code is there and wired", not "clicked".

Direction (Justin, 2026-11-21): **B**. "New workshop" asks only a few things, creates the draft and its workspace, then drops you ON THE WORKSHOP PAGE in edit mode. "Live edit is used more, maybe a bit of direct edit too (live edit includes things having upload/library options for cover areas)." The model is the retired inner-gathering one-page builder, not the wizard. Nothing waits for review for now. Site editors see page versions.

---

## 1. The experience, step by step

### Step 1. Click "New workshop"
It is a button in the three places people already look: the Studio "Workshops" tab (greyed out today), the hub card, and `/hub/compose?kind=workshop`. All three open the same small sheet. No page of forms.

### Step 2. Four questions, and only four
| Question | Why this one |
|---|---|
| **What is it called?** | The page cannot exist without a name, and the name makes the web address. |
| **In one line, what is it about?** | This is the sentence the card and the share preview carry. Without it the workshop looks empty in every list. |
| **When does it start?** (a date and time, or "dates later") | A workshop with no date reads as a rumour. It also becomes the first chapter's date. |
| **Where?** (online, in person with a place name, or both) | It decides whether a video room is made for you (step 4). |

These are the same four the shared Studio form already marks as its quick questions (`packages/studio-forms/src/forms/kinds/workshop/schema.ts`, the sections with `quick: true`: title, why, when, where). The fifth quick row there, "What" (the long description), is dropped: you write that on the page, where you can see it.

**Deliberately not asked:** price, places, banner, hero, colour, chapters, files, emails. You judge every one of those better when you see it on the page. See decision 2 for price.

Button: **Create and open the page.**

### Step 3. You land on the page, already in edit mode
No "saved" screen, no list. The browser goes straight to the real workshop page (the one a visitor will see) with the editor already on. A thin bar across the top says: **Draft. Only you and the site's editors can see this.** Beside it: Preview, History, Publish.

On first arrival the page shows your title and line, the date and the place, and a few obvious gaps with friendly prompts ("Add a banner picture", "Set a price", "Add your first chapter"). In edit mode an empty area is a dashed outline you can click; for a visitor it is simply not drawn.

### Step 4. What was created for you at the moment of Step 2
1. The draft record (title, line, date, place) and an empty page record beside it.
2. **One chapter**, dated from the answer you gave, so the page is not bare.
3. The **materials folder** in Nextcloud, private, with you holding it read and write. (Saving a workshop already does this today: `saveWorkshopAction` calls `ensureWorkshopMaterialsFolder`, then `shareWorkshopMaterials`.)
4. A **Talk room**, only if you said "online" or "both". Otherwise the page shows a quiet "Add a video room" button.
5. Nothing is emailed. Nobody is told. The page is not listed anywhere (decision 1).

### Step 5. Edit each area where it sits
Click anything with a dotted underline or a pencil and it opens right there. The rule is the platform's one-editor rule: change it where you see it; when the thing is a record (the workshop itself), a small line under the editor says so: "This changes the workshop itself."

| Area | What you do | What opens |
|---|---|---|
| **Title** | Click and type on the page | Typing in place |
| **The one line, subtitle, discipline** | Click and type | Typing in place |
| **Price** | Click the price chip | A small panel: Free or an amount, a member price, an optional "pay what you can" minimum and note |
| **Banner picture** | Click the banner (or its empty outline) | The picture chooser: **Upload**, **Library** (site images and your own), **Remove**, plus a **focal-point frame**: drag the picture to choose what stays in view; smaller previews show how it crops as a phone card and as a wide banner |
| **Hero text** (words laid over the hero) | Click and type | Typing in place |
| **Hero media** (a picture or video shown whole) | Click it | Same chooser, or paste a video address |
| **Card picture** (what lists show) | Click the card preview in the side panel | Same chooser. If you never set one, the banner stands in |
| **Page colour** | Click the colour dot | Colour picker |
| **Description** | Click the text | The rich text box, in a panel beside the page (bold, links, lists) |
| **Chapters** | See below | |
| **Materials folder** | Drop files into the Materials band | Upload, or "Open in Nextcloud". Files list with name and size |
| **Video room** | Click the Room chip | "Create a room", "Use my own link (Zoom, Meet)", "Remove" |
| **Emails** | Click "Emails" in the side panel | Two letters in your words: what people get when they join, and the reminder (with "how many minutes before"). Preview, and "send me a test" |
| **Places, sign-up deadline, minimum** | Click the "3 / 12 enrolled" chip | Small panel |
| **Where it appears, who can see it** | Publish panel | Choices |

**Chapters.** Each session is a chapter on the same page, drawn as a numbered card. Click a chapter and it opens in place:
- **title and description** (typed on the page);
- **date, time and length**;
- **online or in person**, and a place;
- its **own picture** (same chooser) and its **own background colour**;
- its **recording or video link**;
- its **files**: drop a file or paste a link, and on each one a switch: **Open** (anyone sees it) or **Participants only** (people who joined);
- buttons: **Add a chapter**, **Move up / down**, **Remove**.

"Add a chapter" puts a new card at the end, already open, cursor in its title.

### Step 6. Look at it as someone else
Top bar, **Preview as**: **Visitor** (signed out: banner, text, open files only, a Join button, a count of held files) and **Participant** (the same page after joining: materials, participants-only files, the room, who else is coming). It is exactly what that person sees, with the editor switched off. This uses the rule the live page already has (`enrolled` decides what shows), so preview is not a second page; it is the real page with the viewer set differently.

### Step 7. Publish
**Publish** opens a small panel with a checklist, not a form:
- Title, one line, date: done.
- Banner: optional (a nudge, not a block).
- **Price: you must choose** Free or an amount, so nobody is surprised.
- Where it appears (the site section, default Offerings) and who can see it (everyone, members, invited).
- A plain sentence of what will happen: "It will appear at /offerings/<name>. People can join. Reminders will go out."

**Publish** makes it public and saves a version at that moment (section 8). **Unpublish** and **Archive** live in the same panel.

### Step 8. What the same page becomes for people who join
One address, more as you get closer (the 2026-09-09 workspace idea, still right):

| Who | What the page shows |
|---|---|
| Anyone | Banner, hero, description, chapters with their open files, price, Join |
| Joined (RSVP, or a paid place) | Plus the materials folder, each chapter's participants-only files, recordings, the video room, who else is coming (members only) |
| You (guide or site editor) | Plus the editor, the roster, add and remove materials |

Nothing moves to a different address when someone joins. Leaving withdraws their share of the folder (already done by `leaveThreadRsvp`).

---

## 2. Which editor does what, and where each value lives

Under the one-editor rules (PLAN section 9.3): any editor may change anything, each value has exactly one home, and a record's value edited on a page changes the record and says so.

### 2.1 The page is code-first; Puck is not used for the core
The workshop page is **a React page in a shared package** (like the series pages), not a block canvas. A workshop always has the same parts, so the code draws them and you edit their values in place. That is why live edit is the main mode, which matches Justin's "live edit is used more, direct edit a bit". Puck and the canvas come in at two optional seams, both later: a **"More on this page" Puck region** under the description (extra blocks, a gallery, a quote), and the page's **look** (section order is fixed; colours and fonts follow the site theme).

### 2.2 The home of every value
"Home" = the one place the value is stored. Every editor writes there; every view reads from there.

| Value | Home | Edited by | Notes |
|---|---|---|---|
| Title | `threads.title` | Fields lens, in place | The slug does not move on edit once published (`keepSlug`) |
| The one line (card and share preview) | `threads.excerpt` | lens, in place | Risk R5: today `description_short` and `excerpt` are two homes |
| Subtitle | `workshop_pages.subtitle` | lens, in place | |
| Discipline, series label, level, language | `workshop_pages.discipline / series_label / level / language` | lens | |
| Description | `threads.body` (HTML) | lens `rich` input, in the panel | Needs a sanitiser (R1) |
| Price, currency | `threads.price`, `threads.currency` | lens, price panel | |
| Member price, sliding minimum and note | `workshop_pages.price_member / price_sliding_min / sliding_scale_note` | lens | `price_member` mirrors `price` when empty (R6) |
| Starts, length | `threads.scheduled_at`, `threads.duration_minutes` | lens | The first chapter's date is its own value, not a copy |
| Online or in person, place name, address | `threads.format`, `threads.location`, `workshop_pages.location_address` | lens | |
| Places, sign-up deadline, minimum to run | `threads.attendee_limit / rsvp_deadline / min_attendees` | lens | |
| Registration state, outside link | `workshop_pages.registration_status / registration_url` | lens | |
| Banner picture, focal point | `workshop_pages.banner_image_url`, `banner_focal_y` | lens `image` input with the framer | Only the vertical focal point has a column today (section 4) |
| Hero picture or video, hero text | `workshop_pages.hero_media_url / hero_media_type / hero_text` | lens | |
| Card picture | `workshop_pages.cover_image_url` | lens | Banner stands in when empty |
| Page colour | `workshop_pages.background_color` | lens `color` input | A stored record value, so it lives here and not in the theme |
| Gallery pictures | `workshop_pages.gallery_image_urls` | later: a Puck gallery block or a lens list | Slice 5 |
| Chapter title, text, date, length, online, place, video link | `workshop_sessions` columns (`topic`, `scheduled_at`, `duration_minutes`) and its `notes` JSONB (`description`, `isOnline`, `location`, `videoConferenceUrl`, `videoUrl`) | lens, one record per chapter (`workshop-session:<id>`) | |
| Chapter picture, colour | `workshop_sessions.notes` (`mediaUrl`, `backgroundColor`) | lens image and colour inputs | |
| Chapter files (each open or participants-only) | `workshop_sessions.notes.resources[]` (`title`, `type`, `url`, `isPublic`) | a new lens `files` input | The files are in media storage; the row holds the link |
| Order of chapters | `workshop_sessions.session_number` | Move up / down buttons | |
| Materials folder | Nextcloud `EAC_Network/<org>/workshops/<threadId>/materials` | upload band on the page | Listed by `listWorkshopMaterials`; one read gate: `canAccessWorkshopMaterials` |
| Video room | `threads.nextcloud_talk_token` (Nextcloud) or `threads.meeting_url` (Zoom, Meet) | Room panel | |
| Join letter | `email_template_settings` row `rsvp-guest:<threadId>` (to confirm, R7) | Emails panel | |
| Reminder letter, lead time | `email_template_settings` row `reminder:<threadId>`; `threads.reminder_minutes_before` | Emails panel | Documented in `packages/types/src/content-form-config.ts:70-74` |
| Draft or published, who sees it, which section | `threads.status / visibility / min_role / section`, `published_at` | Publish panel | |
| Search and share preview | `workshop_pages.seo_title / seo_description / og_image_url` | side panel | Defaults from title and line |
| Guide's name, photo, bio | **the person**: `users.display_name / avatar_url / bio`, `org_profiles.role_title` | NOT on this page in slice 1: a link "Edit your profile" | Today arts-collective's live editor can rewrite a person's profile from a workshop page (`field-registry.ts` rows `fullName`, `facilitatorBio`, `photoPath`): wrong home, remove |
| Page theme (colours, fonts, frames) | the site theme, plus `workshop_pages.theme_overrides` for per-workshop CSS variables | Theme tab (later) | Separate from the page colour above |
| Page versions | `dev_versions`, subject `workshop:<threadId>` | History | Section 8 |

### 2.3 Which tab does what
- **Content tab** (settings and words of a block): applies only to the optional **"More on this page" Puck region**. The fixed parts need no Content tab: their values are record fields.
- **Fields lens / live-editor** (record values, typed in place or in a small panel): **the editor for everything in the table above.** It already has text, textarea, url, number, datetime, date, select, boolean, colour, image (with `choosePicture`), list (one box per line), the "This changes the X itself" line (`shared`), one earlier version per field, and a stale-version check.
- **Look tab**: the only looks the fixed page needs are the page colour and each chapter's colour, and those are record values above. Not needed in slice 1.
- **Theme tab**: later; the workshop's palette from the site's roles.

### 2.4 Where lists need a new input
The lens's `list` input is **lines of plain text** (`checkValue` splits on newlines; each line is a string). It cannot hold a chapter (several fields, a picture, files) nor a file row (title, link, open or not). Two ways:
1. Add a generic "rows" input to the lens (a repeatable group with its own sub-fields). Bigger, and it touches the shared lens.
2. **Pick:** make each chapter its **own lens record** (`workshop-session:<id>`), since chapters are table rows with ids already. Adding, moving and removing chapters are page buttons that call actions. Only **chapter files** need one new lens input, `files` (upload or paste a link, an Open / Participants switch per row, remove). Smaller, and it keeps the lens one-record-at-a-time, which is how it is built.

---

## 3. A map of the page
Edit mode shown. A visitor sees the same page without the outlines and bars.

```
+------------------------------------------------------------------------------+
| DRAFT  only you and editors see this    [Preview as: Visitor|Participant]    |
|                                          [History]  [Publish]                |
+------------------------------------------------------------------------------+
| BANNER  [ picture, full width ]            <- click: Upload / Library / Remove|
|   Discipline (type)                            + focal-point frame            |
|   TITLE  (type)                                                               |
|   Subtitle (type)                                                             |
+------------------------------------------------------------------------------+
| META STRIP: [guide: Name -> Edit profile]  [Price]  [6 sessions]  [Level]     |
|             [3 / 12 enrolled]  [Room]  [Share]       <- each chip opens panel |
+------------------------------------------------------------------------------+
| HERO  [ picture or video, shown whole ]     <- click: chooser                 |
|        hero text laid over the foot (type)                                    |
+------------------------------------------------------------------------------+
| ONE LINE (lead)  (type)                                                       |
| DESCRIPTION  rich text                      <- click: rich box in the panel   |
| Facts: Starts - Rhythm - Where - Access     <- click a fact: small panel      |
+------------------------------------------------------------------------------+
| CHAPTERS                                                                      |
|  01 [title] [date, length, online/place]                [up][down][remove]    |
|     [chapter picture]  [colour]  text                                         |
|     Files: handout.pdf (Open)  reading.pdf (Participants only)   [+ file]     |
|  02 ...                                                                       |
|  [ + Add a chapter ]                                                          |
+------------------------------------------------------------------------------+
| MATERIALS  (drop files here)   Open in Nextcloud                              |
|   a visitor sees "7 files for participants"                                   |
+------------------------------------------------------------------------------+
| MORE ON THIS PAGE   (optional Puck region: gallery, quote, extra blocks)      |
+------------------------------------------------------------------------------+
| JOIN PANEL (RSVP / pay)       ATTENDEES (members)                             |
+------------------------------------------------------------------------------+
| SIDE PANEL (slides in):  Emails - Page colour - Card picture - Search & share |
|                          Places & deadline - Where it appears - Versions      |
+------------------------------------------------------------------------------+
```

**The stage.** Justin sees the surface system's stage as "a hero hybrid... useful for promoting workshops or series or galleries, things with nested content". A workshop's chapters are exactly nested content, and the stage work already maps it (`docs/open/ELKTOURS_BLOCK_FORWARD_2026-11-21/STAGE.md`: stops become sessions, place cards become materials, Book becomes Join). So **the same chapters can be drawn two ways**: the plain stacked cards above (default, built first), and later a **stage** drawing on a phone or in the landing's hero (swipe through chapters, Join in the dock). The stage is a second way to draw the same chapters; it changes where no value lives. Not in the first slices.

---

## 4. Reuse and build

Effort: S under a day, M one to three days, L more than three. Paths are in `~/eac`.

| Piece | Reuse | Missing | Effort |
|---|---|---|---|
| The page (banner, meta strip, hero, chapters, materials, gallery, join) | `apps/innergathering/src/components/workshop-view.tsx` (233 lines, server-renderable, takes `enrolled`, `actions`, `materials`, `aside`), `workshop-materials.tsx` (152), the page branch in `app/[feed]/[slug]/page.tsx` (lines 129-165), the `.ws-*` CSS | Move into the package; `data-field` marks on each editable part; edit-mode outlines for empty areas; stop hard-coding the "Offerings" back link | M |
| Same page on arts-collective | arts-collective draws a Silex-style HTML template string (`renderWorkshopTemplate`, `app/sites/[slug]/[contentSlug]/page.tsx`), not React. 0 workshops there | Mount the shared page in place of the template for `kind='workshop'`; keep the template behind the Silex flag | M |
| Create sheet (4 questions) | `studio-forms` `workshopKind` quick rows; `workshopInputFromAnswers` (`packages/services/src/workshop-answers.ts`); `upsertWorkshopOffering` (accepts `status:'draft'`, has `keepSlug`) | One `createWorkshopDraft`: the upsert plus first chapter, folder, share, optional room, returning the page path; "dates later" (null date) allowed; flip `ready:true` in `packages/studio/src/kinds.ts:26` | M |
| Showing a DRAFT on the page | `getWorkshopOfferingById` returns any status | **Gap.** The page route cannot show a draft today: innergathering's `getThreadBySlug` filters `status = 'published'` (`lib/data.ts:254-261`) and `getWorkshopOffering` does too, so a draft is a 404 even for its author. Needs an editor-only draft read on the route | S |
| Record fields in place | Fields lens `packages/house-editor/src/fields/*` (`registry.ts`, `save.ts`, `FieldsLens.tsx`); `cms-bindings/src/workshop/field-registry.ts` (about 55 fields already mapped to table and column, with labels, hints, options) | A `workshop` kind for the lens built from that registry (declared once, not retyped), with the `shared` line | M |
| Safe save | Lens `save.ts` routes through an atlas capability (`performAction`: gate, zod input, audit row, `updated_by`) | **A workshop-fields service function with an allow-list, per-field limits, sanitisers (plain text, link, rich body, hex colour) and an audit row.** Replaces the raw `UPDATE threads SET ${db(cols)}` at `apps/arts-collective/src/lib/cms/actions.ts:331` | M |
| Pictures: upload, library, focal point | `cms-ui/src/files/MediaPicker.tsx`, `make-choose-picture.tsx` (upload endpoint and libraries per site), `CoverFramer.tsx` (drag to frame, zoom, other-box previews); the lens `ImageInput` already takes `choosePicture` | The framer inside the image input for banner and card; a column for the full frame (x and zoom) if wanted (today only `banner_focal_y`) | S chooser, M framer and column |
| Chapters | `workshop_sessions` table; `SessionCard` in `workshop-view.tsx`; `cms-ui/src/compose/SessionsEditor.tsx`; the archived `SessionEditorCard` (title, text, date, length, online, place, image, video, colour, file dropzone, 200 MB cap) | **Per-row writers.** `replaceWorkshopSessions` (`services/src/workshop-offerings.ts:723`) deletes every session and re-inserts with new ids on each save, so a per-chapter edit would lose ids and links. Need `updateWorkshopSession(id, patch)` (merging `notes`), `add`, `move`, `remove`; a lens kind `workshop-session`; the `files` input | L |
| Chapter files and materials folder | `uploadWorkshopMaterial`, `deleteWorkshopMaterial`, `listWorkshopMaterials`, `ensureWorkshopMaterialsFolder`; route `apps/innergathering/src/app/api/workshops/[id]/materials/route.ts` (atlas `ig-workshop-material-add/remove`); `/api/upload`; media gate `canAccessWorkshopMaterials` | Move the materials route into the package so arts-collective gets it (it has none); `shareWorkshopMaterials` is app-local (`lib/workshop-share`), so it becomes a config hook | M |
| Talk room | `createTalkRoom` (`services/src/nextcloud.ts:353`); arts-collective `tryCreateTalkRoom` (`actions.ts:229`); the page reads `nextcloudTalkToken` | One `ensureWorkshopRoom(threadId)` in services (best-effort, never blocks); Room panel | S |
| Emails | `email_template_settings` per-thread keys (`email/src/template-store.ts:53`); the hub email editors (`apps/innergathering/src/app/hub/email`); reminder tick filters `status='published'` (`services/src/attendee-reminders.ts:91`) | An Emails panel on the page reading and writing those rows; "send me a test" to the author only | M |
| Preview as visitor / participant | `enrolled` is already a parameter of `WorkshopView`; materials are already masked for visitors | A viewer switch in edit mode forcing `enrolled` and `canEdit` | S |
| Publish with checklist | `upsertWorkshopOffering` (`status:'published'` sets `published_at`); atlas `workshop-save` | A publish function with readiness rules (title, line, date, price decided) and revalidation of the section and page | S |
| Versions | `dev_versions` (migration 281, `apps/development/src/lib/versions.ts`; subject-generic, `"block:<app>:<id>"` now and `"page:<org>:<slug>"` later) | Subject `workshop:<threadId>`; a snapshot at publish and "Put back"; the store moving to `services` | M (slice 5) |
| Rich description box | `cms-ui` `RichTextEditor`; lens `rich` kind | Sanitise on save | S (with the safe save) |
| Payments | `rsvp-handler` paid branch (`createThreadOrder`, `startStripeCheckout`); `price`, `price_sliding_min` | Nothing new to build; decision 2 | none |

### Risks, in order of weight
- **R1. Unsanitised save (Manjushri finding, confirmed).** `updateWorkshopFieldAction` builds `UPDATE threads SET ${db(cols)}` from a trait map with only numeric coercion, no length or content check, and does not go through `performAction`, so there is no audit row. It also lets an org editor rewrite a person's profile (`users.*`). The new page must not launch on that path. Step 0 of the plan is the safe service function, and `updateWorkshopFieldByTraitAction` becomes a thin shim over it, so arts-collective is fixed the same day.
- **R2. Emails firing from a draft.** The joining mail (`rsvp-handler`) needs a published thread, and the reminder tick filters `status='published'`, so a draft sends nothing. The risk is a **republish**: editing a published page must not re-send anything to people already in. Keep Publish and Save separate and never trigger joining mail on save. Test-send goes to the author only.
- **R3. The Nextcloud folder on draft.** A folder at first save means abandoned drafts leave empty private folders, and `deleteWorkshopOffering` does not remove them. Harmless but untidy. Do not delete folders automatically (irreversible); leave a clean-up note on the board.
- **R4. Payments.** A price on a published workshop sends joiners to Stripe. Changing a price after people paid does not touch their orders, and cancelling a paid place only records a refund as due (atlas note on `ig-rsvp-cancel`). So: price is freely editable on a draft; on a published workshop with paid places the panel warns "N people have paid at the old price" and the change applies to new joiners only.
- **R5. Two homes for "the one line".** `threads.excerpt` and `workshop_pages.description_short` both exist; the service writes `excerpt ?? descriptionShort`. A live edit of only one leaves the card stale. Pick one home (pick: `excerpt`, with `description_short` kept in step by the save function) or retire one.
- **R6. `price_member` mirrors `price` when empty at save** (`upsertWorkshopOffering`). A field-level price edit would leave the member price stale; the safe save keeps the mirror rule.
- **R7. The "welcome" email key.** In `TEMPLATE_KEYS`, `welcome` is the account welcome, not a workshop one. The joining letter is most likely `rsvp-guest`. Confirm against `rsvp-handler` before the Emails panel is built.
- **R8. `session_count` and `session_duration_hrs` on `workshop_pages`** are stored numbers that can disagree with the real chapter rows. The page shows the real count; derive or hide these two.
- **R9. Two live-edit paths.** arts-collective's `live-editor` overlay (data-trait pins) and the house editor's Fields lens (data-field marks) must not both mount on one page. The new page uses the lens only; the overlay stays for the Silex template until retired.

---

## 5. Shape: a shared package

### 5.1 Name and contents
**`@elkdonis/workshop-site`** in `packages/workshop-site`, modelled on `@elkdonis/series-site` (a page shipped as a package; each site passes a small config object).

| Export path | What it is |
|---|---|
| `/config` | `WorkshopSite` interface: `orgId`, `orgName`, `domain`, `getViewer()`, `chrome` (Shell, Header, Footer), `pathFor(section, slug)` (how this site addresses a workshop), `defaultSection`, `choosePicture` (upload endpoint and libraries, from `makeChoosePicture`), `shareMaterials(threadId, userId, role)`, `payments` on or off, the app's `"use server"` fields actions for the lens |
| `/pages` | `WorkshopPage` (server component: loads the offering, works out who sees what, draws the view, mounts the editor for editors) and `workshopMetadata` |
| `/components/*` | `WorkshopView`, `Chapter`, `Materials`, `JoinPanel`, `Facts`, and the edit-mode wrappers. Moved from `workshop-view.tsx` and `workshop-materials.tsx` |
| `/fields` | The `workshop` and `workshop-session` kinds for the Fields lens, built once from `cms-bindings` `fieldRegistry`, plus the `createFieldsActions` wiring |
| `/routes` | `materials` (add, remove), `join` (a shim to `rsvpRoutes`), `create` (the draft maker), `publish` |
| `/hub` | `NewWorkshopSheet` (the four questions) |
| `/site.css` | The `.ws-*` styles |

Server logic that is not about a page (`createWorkshopDraft`, `updateWorkshopFields`, the per-chapter writers, `ensureWorkshopRoom`) goes in `@elkdonis/services` beside `upsertWorkshopOffering`, so any app can call it without the page package.

### 5.2 How a site mounts it
```
app/<workshop route>/page.tsx          -> <WorkshopPage site={workshopSite} feed=... slug=... />
app/workshops/new/page.tsx (or popup)  -> <NewWorkshopSheet site={workshopSite} />
app/api/workshops/[id]/materials/route.ts -> re-export from /routes
```
Each app adds one `lib/workshop-site.ts` (like `lib/series-site.ts`): its org, chrome and hooks. Nothing else is app-specific.

### 5.3 Adoption
- **innergathering** (live; 6 archived workshops and 1 test): replace the workshop branch of `app/[feed]/[slug]/page.tsx` with `WorkshopPage`; delete the local `workshop-view.tsx` and materials copy after a pixel check against the 6 archived pages; the hub Publish page gets its missing workshop door. innergathering stays on the block-pass build (board decision 10), so this lands as source, is checked signed in on a dev copy, then built.
- **arts-collective** (0 workshops): mount `WorkshopPage` for `kind='workshop'` on `/sites/<slug>/<contentSlug>`; keep the Silex template behind its flag; retire `WorkshopForm`, the guided wizard and `updateWorkshopFieldByTraitAction` after parity.
- **Other sites** (sunjay, ifac, hidden-enneagram, elktours): get workshops by adding the same config file; the studio-forms workshop kind already exists for them.

### 5.4 The two doors that point to it
- **Studio "workshop" tab** (`packages/studio/src/kinds.ts:26`, `ready:false`): flip to ready and make it a **launcher**, not a form: a "New workshop" tile that opens the four-question sheet, then a list of the person's workshops with Open (the page, in edit mode).
- **`/hub/compose?kind=workshop`** (the old composer with Sessions): redirect to the same sheet. The composer's workshop branch and its Sessions and Presentation groups retire after parity. The popup `compose:workshop` and `/manage/content/new?kind=workshop` open the sheet too.

### 5.5 Atlas capabilities
Reuse (existing ids, from `atlas:q -- workshop --full`):
- `workshop-save` (orgapps.meetings): create and update through `upsertWorkshopOffering`; the create sheet and publish call it or its successor.
- `ig-workshop-material-add`, `ig-workshop-material-remove`: materials; become shared-package routes.
- `ig-rsvp-join`, `ig-rsvp-cancel`, `rsvp-to-event`, `cancel-rsvp` (the merged `rsvp-handler`): joining and leaving, unchanged.
- `edit-workshop-live`: stays for arts-collective's overlay until retired; then replaced by `workshop-field-save`.
- `create-content` (arts-collective): its workshop branch retires.
- `upload-image`: the chooser's upload.

New (proposed ids):
| Id | Does | Risk |
|---|---|---|
| `workshop-draft-create` | The four answers become the draft, first chapter, folder, share, optional room; returns the page path | public, writes storage |
| `workshop-field-save` | One or more fields of a workshop through allow-list, limits and sanitisers, with an audit row. The lens's capability for kind `workshop` | public |
| `workshop-session-save` | One chapter's fields (merging `notes`) | public |
| `workshop-session-add`, `-move`, `-remove` | Chapter structure | remove is irreversible |
| `workshop-room-ensure` | Create or replace the video room | others |
| `workshop-publish`, `workshop-unpublish` | State change with readiness rules and a version snapshot | public; reminders begin |
| `workshop-emails-save` | The two letters and the reminder lead time | emails |

---

## 6. A first slice (about 2 to 3 days), seen on a dev copy

**Site: innergathering**, on a throwaway dev copy with the test account and every save aborted (the board's rule). It has the live page, the folder code, the materials route and 6 real workshops to compare with. arts-collective has 0 workshops, so it would prove nothing yet.

**Areas (and only these):**
1. **Step 0, the safe save:** `updateWorkshopFields` in services (allow-list, limits, sanitisers, audit row) plus capability `workshop-field-save`; arts-collective's by-trait action becomes a shim over it. About half a day.
2. **The four-question sheet and `createWorkshopDraft`**, opening the page in edit mode, including the editor-only draft read (the 404 fix). About one day.
3. **On the page, in place: title, one line, price, banner with chooser and focal point, hero text, card picture, page colour.** All single record fields, so this is the lens plus the picture chooser already used on other sites. About one day.
4. **Draft bar, Preview as visitor / participant, Publish with the checklist.** About half a day.

**Not in slice 1:** editing chapters, chapter files, the Emails and Room panels, versions, the stage, arts-collective. Chapters still display from stored rows. The new code lives in `packages/workshop-site` from the start with innergathering mounting it, so slice 2 does not move code again.

**What you would see:** click New workshop, answer four things, land on your draft, click the banner and upload a picture and drag its focal point, type the title, set the price, flip to "Preview as visitor", publish, open the public address.

### Following slices, in order
2. **Chapters** (the big one): per-row writers, the `workshop-session` lens kind, add / move / remove, chapter picture and colour, the `files` input with Open / Participants only, the Materials band with upload.
3. **Room and emails:** Talk room create or own link; the Emails panel (join letter, reminder, lead time, test to me).
4. **Doors and arts-collective:** Studio tab ready as a launcher; `/hub/compose?kind=workshop` and the popups point to the sheet; arts-collective mounts the same page; retire the duplicates after a parity check.
5. **Versions and More-on-this-page:** `workshop:<id>` snapshots at publish with "Put back"; the optional Puck region; gallery.
6. **Stage and look:** the stage drawing of chapters for phones and the landing; Theme tab; the full cover-frame column if wanted.

---

## 7. Decisions for the owner

1. **Who can see a draft, and where?**
   - (a) Only the author and the site's editors, at its real address (a 404 for everyone else). **Pick.** It is the page you will publish, so preview is true.
   - (b) A private link anyone can open (good for showing a friend before launch).
   - (c) Also listed on a "Drafts" shelf in the hub.
   Pick (a) now; add (b) later if wanted.
2. **Price: at creation or later?**
   - (a) Not asked at creation; set on the page; **Publish insists you choose Free or an amount.** **Pick.**
   - (b) Asked as a fifth question.
   - (c) Free by default and never nagged.
   Pick (a): four questions stay four, and a price is easier to judge beside the description.
3. **Are chapters sections of one page, or pages of their own?**
   - (a) Cards on the one page. **Pick.** It keeps "one address, more as you get closer" and is what the prototype did.
   - (b) Each chapter has its own address (better for a 12-week course where each week is long).
   - (c) Cards now, an optional own page per chapter later.
   Pick (a), leaving (c) open by giving each chapter a stable id from slice 2 on.
4. **What can a participant do on the page?** Today: see materials and their files, open the room, see who else is coming. Options: (a) nothing more yet. **Pick.** (b) leave a note or question under a chapter; (c) mark a chapter done; (d) upload their own work. (b) is the next most natural and would reuse the discussion block.
5. **Is a video room made automatically?** (a) Only when you say online or both. **Pick.** (b) Always. (c) Never; you click to add one.
6. **Emails: written at creation or on the page?** (a) On the page, with good defaults in place so a workshop works without touching them. **Pick.** (b) Not offered; site defaults only.
7. **Facilitator details.** (a) Link out to "Edit your profile" and show the guide read-only on the page. **Pick.** (b) Edit name, photo and bio right there. That changes the person's profile everywhere, which breaks "one home" for people; only with a "this changes the person" line, and only for the author themself.
8. **Recurring workshops** (a standing weekly with host rota, "is it happening", attendance). (a) Stay "meeting series" for now. **Pick.** (b) Let a workshop repeat: this is Option C in `workshop-creation.md`, a separate, larger decision with a migration.
9. **Retire the old doors?** After parity: the arts-collective wizard and full form (0 rows), the composer's workshop branch, the by-trait live overlay. **Pick: yes, one at a time as slices 2 and 4 land.** The archived July workshops are untouched either way.
10. **Where is a published workshop listed by default?** Section "offerings" on innergathering (as today) and the site's workshops page elsewhere; the network feed as a tick in the Publish panel (it exists as `shareToNetwork`). **Pick: that, with the network tick off.**

## 8. Page versions (site editors see them)
`dev_versions` is already subject-generic and never edits a version row. Each publish writes a row for subject `workshop:<threadId>` holding the page's record values (the table in 2.2, without person or money rows), with the author and a note. History lists them for site editors and offers "Put back", which writes the old values through the same safe save, so putting back is itself audited. The lens's one earlier version per field keeps working underneath for quick undo. Nothing waits for review: a version is a record of what was, not a gate.

## 9. What I could not verify
- Whether the prototype's "welcome email" was the joining letter (`rsvp-guest`) or a distinct per-workshop letter. I read the template-key list, not the prototype's save code for it.
- Browser behaviour, including how the lens's image input and the existing `CoverFramer` would sit together in one panel.
- The archive paths in the brief do not exist as named: `archive/inner-gathering` holds only `src/` (the create page is there), with no `workshop-view.tsx`, `workshop-actions.ts` or `docs/archive`. I read the live equivalents in `apps/innergathering/src` and the 2026-09-09 workspace note from `.claude/worktrees/friendly-chatterjee-02414e/WORKSHOP_WORKSPACE_2026-09-09.md`. I did not read the 2026-09-01 debrief beyond what `workshop-creation.md` quotes from it.
