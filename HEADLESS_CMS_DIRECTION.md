# The headless CMS — direction

Working note, 2026-09-07. Not a plan to execute; the shape to build toward, so
the next increment doesn't cut across it.

## The one sentence

**One thread, many authoring surfaces, optionally one template.** Everything
below follows from refusing to let "how it's authored" and "how it's presented"
become part of "what it is."

## Three axes that keep getting collapsed into one

The repo's duplication comes from treating these as a single decision, so each
new content type re-implements all three:

| Axis | Values | Where it lives |
|---|---|---|
| **What it is** | post, event, meeting, workshop, questionnaire, poll, product, forum post | `threads.kind` / `questionnaires.kind` — **data**, no CHECK constraint on `threads.kind`, so a new kind needs no migration |
| **How it's authored** | quick popup, full form, guided wizard, rich blog editor, in-place live edit | The compose surface — `@elkdonis/cms-ui/compose` |
| **How it's presented** | default template, a Silex template, a bespoke page | `manifest.json` bindings via `@elkdonis/cms-bindings`; `organizations.layout_mode` |

A blog post and a forum post are the same *what*. They differ on the second and
third axes only. That is the whole insight — and it is why the answer is not
another `kind`, but a surface choice over a kind that already exists.

## The CMS and the wizard are the same substrate

- **CMS surface** — detailed, everything at once, for someone who knows what
  they're making.
- **Wizard surface** — the same fields, paginated, with the decisions ordered
  and explained, for someone who doesn't.

They already share the machinery: `WizardFieldSpec` + `WizardFieldControl`
render the fields, `WizardProvider` holds draft state and autosave, and
`field-registry.ts` is the single declaration of what a workshop *has*. The
wizard is not a different editor; it is the same field list with steps and
guidance layered on. Choosing between them should be a per-author preference,
not a different code path — and today it is a different code path in every app.

**Both feed a template when one is chosen and available.** `buildWorkshopWizardSteps`
already derives its steps from a template manifest, which is the proof of
concept: the template says which sections exist, the manifest says which fields
bind into them, and the wizard is generated from that rather than hand-written.
Extending that to every template is the `template_id` work — there is no
`template_id` column yet on `organizations` or `workshop_pages`, so template
choice is currently hardcoded (`loadTemplateManifest("workshop")`).

## Blog is a surface, not a kind

A blog post is `threads.kind = 'post'`. Choosing "Blog" in the compose catalogue
should not create a different row — it should **unlock a different surface**: a
focused, distraction-free writing environment with a real rich-text editor, a
cover image, an excerpt, scheduling, and a preview that looks like the published
page. Same row, same feed, same subdomain rendering.

That framing also answers the blog stack's current gap. `updatePost` and
`deletePost` exist in `@elkdonis/services` with zero callers, `BlogPostEditor`
never sends a `status`, and there are zero draft rows — because the blog surface
was built as a *create* form rather than as a writing environment. A blog
surface that takes writing seriously has to have edit, drafts and delete in it
from the start; those service functions are already waiting.

**Forum post** is the same argument again, once `apps/forum` works. Today every
page of that app 500s because `packages/db/src/queries/forum.ts` still queries
`posts` and `meetings`, which migration 030 dropped. When it comes back, a forum
post is a thread with a conversational surface and a threaded presentation — not
a new table.

## What exists now

- `@elkdonis/cms-ui/compose` — `buildComposeCatalogue(ctx)` derives what an org
  can make from what it *has* (feeds, workshops, meetings, management rights),
  so two hubs offer different things without either app hardcoding a list.
  `ComposeSheet` is the shared popup shell; the host app supplies the body.
- `QuestionBuilder` authors `questionnaires.fields`, which nothing wrote before.
- `questionnaire.ts` maps stored fields onto `WizardFieldSpec`, so questionnaire,
  poll and wizard share one set of controls.
- Migration 103 gave `questionnaires` a `thread_id` and a `kind`, so a
  questionnaire can *be* content and inherit publishing, feeds and org scoping.

## Corrections from 2026-09-07

Three facts that change earlier reasoning:

- **`blog-sunjay`, `blog-guru-dharam` and `blog-tester` are throwaway drafts.**
  They are also the *only* three adopters of the shared media-route factory. So
  the factory's real adoption is **zero live apps**, not "3 of 11", and
  `@elkdonis/blog-server` is a package named after three dead sites. Re-home the
  factory before leaning on it.
- **inner-gathering is coming off Mantine.** No Mantine adapter is needed; the
  CMS merge is 4-into-1, and `create-content-form.tsx` (753 lines) becomes a
  straight fold rather than a port.
- **The Nextcloud document round-trip is half-built.**
  `createCollaborativeDocument` (`packages/services/src/nextcloud.ts:317`)
  already writes a `.md` file, gets its `fileId`, and creates an edit share;
  `threads.nextcloud_doc_url`, `nextcloud_file_id` and `nextcloud_last_sync`
  all exist. **0 of 35 threads have any of them set** — it has never run.

  Three gaps to a two-way blog document: it is one-way (nothing reads the file
  back, and `nextcloud_last_sync` is never written — that column is exactly the
  sync state that is missing); it writes to `EAC_Network/<org>/Media/Documents/`
  rather than the author's own `EAC_Network/users/<slug>/`; and it creates a
  *public* edit share, which is right for meeting notes and wrong for a draft.

## The next honest increments, in order

1. ~~Fold the content form into the compose sheet.~~ **Done for the hub's
   compose cards** — article, event and meeting now render through
   `ContentComposer`, whose field list is `content-fields.ts` data. The 696-line
   `CreateContentDialog` is still live for three other entry points
   (SubdomainEditorBar, guide announcements, the network tab's contribute-news);
   its forks in amrit-canada (488) and hidden-enneagram (429) go when those do.
2. ~~`MediaPicker` as a pane.~~ **Done** — it fills the composer's `media` slot in
   both arts-collective and amrit-canada, and the library listing behind it is
   now `listOrgMediaLibrary` in services (was duplicated at 79 and 57 lines).
   `media-field.tsx` in amrit-canada (213) and hidden-enneagram (204) still
   stand, because they belong to the *old* forms; they go when those do.

   **Rule, settled 2026-09-07: media is never a URL box.** An image field is
   always a picker over the org's or the person's own storage. A pasted URL is
   how you get a dead link, an asset hosted somewhere the org does not control,
   and nothing in the library to reuse. `questionnaires`' `image` type maps to
   `custom` for this reason, and a `custom` field with no picker says so rather
   than degrading to a text input.
3. **Re-home the media route factory** out of `blog-server`, then adopt it in
   the eight apps that matter (currently 0).
4. **A `surface` field on the catalogue** — `quick | full | wizard | blog` — so
   choosing Blog opens the writing environment and Article opens the popup, over
   the same `kind`.
5. **`template_id`**, so a kind plus a template generates its own wizard steps
   and its own bound page, for every template rather than only `workshop`.
6. **Render a questionnaire/poll.** Answering exists in services
   (`saveResponseAnswers`, `submitResponse`); `tallyPoll` exists in cms-ui. What
   is missing is the page that puts them together.
7. **Blog**, on the document round-trip.

   **The round-trip now exists and is verified (2026-09-07).**
   `packages/services/src/thread-document.ts`: `attachThreadDocument` writes a
   markdown file into the AUTHOR'S own `EAC_Network/users/<slug>/Documents/`,
   `syncThreadDocument` reconciles it with `threads.body`, and
   `getThreadDocument` reports where it lives. `dav.ts` gained the read half it
   never had — `davGetText` and `davLastModified` — which is why
   `threads.nextcloud_last_sync` had sat unused since the schema was written:
   nothing could read a document back to compare it.

   Verified against live Nextcloud, not inferred: MKCOL 201 (jg's `Documents/`
   did not exist and now does), PUT 201, HEAD returning a real `last-modified`,
   GET returning the exact bytes, DELETE 204.

   Two deliberate differences from the older `createCollaborativeDocument`,
   which stays as the org-scoped path for meeting notes: the file is the
   author's, not the org's, and there is **no public share** — that function
   mints a link anyone can edit, which is right for meeting notes and wrong for
   a draft.

   The sync rule is last-writer-wins on timestamp and deliberately not a merge:
   two-way merge of prose needs a CRDT, and pretending otherwise eats edits
   silently. `nextcloud_last_sync` records when the two sides were last known
   equal, so "has the file changed since?" is answerable.

   **Still to build:** the writing surface itself — a focused blog editor that
   is not the compose popup — and the UI that calls
   `attachDocumentAction` / `syncDocumentAction`
   (`apps/arts-collective/src/lib/cms/document-actions.ts`, author-gated).

8. **The reading layer — built 2026-09-07.** `@elkdonis/cms-ui/article`
   (`ArticleView` + `article.css`) is one typographic system for a published
   piece of writing, wherever it is read: an org's subdomain, its custom
   domain, or behind a card someone clicked in a feed. Plain CSS with
   custom-property fallbacks, so it sets correctly in the non-Tailwind apps too.

   Three measurements carry it — measure `63ch`, size `20px`, leading `1.62` —
   and they stay CONSTANT across the network. An org sets its accent and
   masthead, not its measure. The apparatus (byline, dateline, colophon) is set
   in monospace, because it is the registry entry around the writing rather
   than writing; the colophon renders custody from `threads.author_id` and
   `thread_orgs`, which is what makes a page a published record rather than a
   page with words on it.

   Proposal and specimen: https://claude.ai/code/artifact/a88aa252-3ef3-4ee9-a5b6-cc0d6c53f234

   **This also fixed the audit's #2 user-visible bug.**
   `/sites/[slug]/[contentSlug]` required `t.kind = 'workshop'` while `/profile`
   linked every feed item, so every post, meeting and service 404'd on its own
   org's site. `getPublicThread` is the kind-agnostic sibling; workshops keep
   the bound template, everything else reads. All four URLs the audit recorded
   as 404 now return 200.

   **One dependency owed:** no markdown renderer is installed, so a
   `body_format='md'` body (what the Nextcloud round-trip produces) is shown as
   escaped, whitespace-preserved text rather than being formatted wrongly. All
   35 published threads are `html` today, so nothing hits that path yet. Add
   `marked` when the blog surface lands.

9. **File browsing** — `FilesCard` now takes `sources`, so a hub can show the
   person's own storage AND the org's team folder in one card with a switcher,
   rather than making someone know which tree a file is in before they look for
   it. Each source keeps its own root, and a source can be read-only.

## Addendum, 2026-09-07 (later): the surface system

Increment 4 above asked for a `surface` field on the catalogue. What got built
is one level up: **`@elkdonis/cms-ui/surface`**, the popup system every CMS
feature now opens in. A *face* (card) and a *surface* (popup) are the same
object at two sizes; every surface opens in ONE native `<dialog>` per app and
they stack (calendar → day → quick-add → the thread you made); the top layer is
mirrored to `?surface=thread:<id>` so a popup is a link and Back closes it.
Plain CSS with `--eac-surface-*` / `--eac-kind-*` tokens, so it sets in the
non-Tailwind apps too.

The "quick popup vs full form" axis is now a **tier over one field list**:
`quick: true` on fields in `content-fields.ts`, `ContentComposer tier="quick"`.
A calendar day's "+ add" opens the quick tier prefilled with the date; "More
options" widens to full without losing input. Blog remains the one surface not
built — it is what the `full` width is reserved for.

Reference host: amrit-canada's hub (`components/hub/HubSurfaces.tsx` supplies
the connectors, `/api/hub/threads/[id]` is the read). Design note with the live
anatomy and screenshots is the "Surfaces" artifact. Known seam:
`WizardFieldControl` is still Tailwind utilities, so the compose surface is
unstyled in ifac/artdirect until those controls get plain-CSS classes.

## Addendum, 2026-09-09: chrome inversion — Silex renders *under* the app

A published Silex page arrives as a whole document: nav, content, footer. When
an app renders one inside its own layout, the visitor gets two navs stacked,
and the Silex one is inert — `sanitizeSilexHtml` strips `<script>`, so no
published artifact of ours can carry behaviour. hidden-enneagram's home page
shipped exactly that: a React `AuthNav` above the template's decorative
hamburger, which was three `<span>`s with nothing behind them, over links the
stylesheet hides below 600px. There was no way to navigate on a phone.

The fix inverts the relationship. **Silex renders the content; the React app
keeps the chrome.**

- `removeSections(html, sectionIds)` in `@elkdonis/cms-bindings/engine` drops
  named sections from a published document, using the same `data-gjs-type` →
  class fallback lookup `applyManifestBindings` uses to find them.
- `SilexSite` / `SilexSiteBySlug` take `omitSections?: string[]` and apply it
  immediately after `rewriteAssetUrls`, *before* binding and sanitising — so
  bindings are never spent on markup that is about to be removed.

Because this runs at render time it repairs sites already published to
Nextcloud without a republish, which matters: the enneagram artifact on disk
dates from 2026-06-09 and nobody is going to re-open Silex to fix a nav.

hidden-enneagram now passes `omitSections={["eac-enn-nav"]}` on `/` and on
every Silex page under `/[page]`, and `SiteNav` — split into a server half that
reads `org_feeds` and a client `SiteNavBar` that owns the drawer — is the one
bar on every route, published or database-driven. `AuthNav` is deleted.

The general rule for any org site that mixes the two: keep in the template only
what is genuinely static, and let the app own anything with state. Nav, auth,
search and dialogs belong to React. Nothing else about the template changes.
