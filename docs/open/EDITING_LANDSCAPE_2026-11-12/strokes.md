# Editing landscape: bold strokes (Lane 2), 2026-11-12

Read-only. By system32-a2 for PM system32-d6. Nothing was edited, built or committed. Paths are under `~/eac`. The sibling inventory is `detail.md`, by system32-fc.

## 1. sunjay spawn paths

| Path | Click | What draws the page | Can the house edit it? |
|---|---|---|---|
| Post (`kind=post`) | Feed card → thread popup (`cms-ui/src/surface/surfaces/ThreadSurface.tsx:228` "Open page" → `thread.href`) → `/<feed>/<slug>` | `app/[feed]/[slug]/page.tsx:83-115`: hard-coded `ArticleView` (`@elkdonis/cms-ui/article`) | **No.** Not Puck, no template. "Edit" (`components/edit-thread-button.tsx`) opens the writing-room surface on the record, not the page |
| Writing piece (`kind=writing`, Studio) | Journal card → `/journal/<piece>` | `app/journal/[piece]/page.tsx`: `journal-piece` template if published (`lib/puck/templates.ts` `JOURNAL_PIECE_TEMPLATE`), else bare `Article` | Template only, at `/studio/journal-piece`. One document for every piece |
| Meeting | Popup "Open page" → `/<feed>/<slug>` | Plain `SurfacePage` by default (`[slug]/page.tsx:150-295`). The editor's `EventPageToggle` (`components/event-page-toggle.tsx` → `lib/puck/event-actions.ts setDetailPageAction`) sets `threads.metadata.detailPage` and makes a Talk room. After that, the `event-detail` template is drawn with `metadata.threadId` (`[slug]/page.tsx:120-141`) | Template only, at `/studio/event-detail`. Blocks find the meeting through `ctx.threadId` (`lib/puck/data-event.ts`) |
| Custom page | `/manage/builder` → New page → `/studio/<slug>?template=` (`components/manage/new-page-form.tsx:25`) | `/[feed]` fallthrough → `renderPuckPage` | Yes, but there is **no Edit button on the live page** (`app/[feed]/page.tsx` has no edit entry). You go back through `/manage/builder` |
| Home `/` | "Edit page" (`components/landing/EditPageButton.tsx`) | `openVisitorPage` in place (`components/landing/page-editor-mount.ts`) | Yes, in place. No `records`, no `blockEditorHref`, no `editSettings` |

**How a spawned page becomes editable.** It is one switch per record (a jsonb flag), and the record is passed in as route metadata to a single shared template. The page itself is never stored per record.

**Bottlenecks, worst first:**
1. **Posts have no template.** "Post → detail page" ends on coded `ArticleView`, so the house never sees it. `kind=post` (feeds) and `kind=writing` (journal) are two article paths, and only one of them is Puck.
2. **One template draws every page.** A save to `event-detail` or `journal-piece` goes live on every record at once (`CanvasEditor.tsx:39-42` warns about this). There is no per-record override, no draft, no "preview with <record>", and `page_revisions` doesn't exist (contract §6).
3. **No way in from the spawned page.** The designed event page shows `EditThreadButton` (the record) and the toggle, but nothing that opens its layout. The template is reached only from `/manage/builder`.
4. **The opt-in is hand-wired per kind.** `detailPage` flag, plus `readDetailPage`, plus a `renderPuckPage` branch in the route. The kit's `defineRouteTemplate` (SMART_COMPONENTS_KIT §2.1) is the generalisation, but only HE and katie have moved toward it, and sunjay isn't on it.
5. **The record key is per template.** `metadata.threadId` here, `piece` on journal, and other names elsewhere. The contract's single `metadata.subject` (§2 item 7) isn't built yet.

## 2. Puck ↔ direct-edit handoff today

| Direction | Exists | Where | Gap |
|---|---|---|---|
| Puck → direct-edit (one block) | Double-click or "Edit look" in Studio opens the canvas block popup on a working copy and hands back one `replace` | `page-builder/src/parts/popup.tsx` → `direct-edit/src/puck/studio-popup.ts` → `canvas/popup.ts` (nested `mountTreePage`) | In the popup, `editSettings` is off when `nested` (`tree-editor.ts:502`), so you can't go back to Puck from inside it |
| Puck → direct-edit (parts in place) | Parts plugin plus look panel in Puck's right column | `page-builder/src/parts/*`, `direct-edit/src/puck/look-panel.ts` | None. This works (sunjay, elktours, HE, katie) |
| direct-edit → Puck (one block, popup) | **New 2026-11-11.** `editSettings` lets the canvas open `openBlockSettings`: Puck with only that block (drawer, drag and insert off), Apply/Cancel, canvas paused, one undo step | `page-builder/src/block-settings.tsx`, `direct-edit/src/canvas/tree-editor.ts:498-520`, `puck/mount.ts:46` | **HE only** (`apps/hidden-enneagram/src/components/studio/CanvasEditor.tsx:130`). sunjay and innergathering don't pass it |
| direct-edit → Puck (whole page) | `blockEditorHref` "Edit its settings" link | `tree-editor.ts:906`. sunjay sets `/studio/<slug>` (`components/studio/CanvasEditor.tsx`) | Full navigation away from the canvas. Two save buttons over one row, last write wins |
| House (one document, two rooms) | Harness only | `direct-edit/harness/frankenstein/house.tsx` | Not product code. No shared selection, no handoff rails in apps |

**"Direct-edit inception"** (Puck takes over, then hands back to direct-edit inside its own popup):
- Half of it exists: canvas → Puck one-block popup (HE).
- Missing:
  - (a) `openBlockSettings` mounts plain `<Puck>` with **no plugins** (`block-settings.tsx:46-72`), so there's no `partsPlugin` and no look panel, and double-clicking a block inside it does nothing;
  - (b) the canvas popup refuses `editSettings` when `nested`;
  - (c) there's no stack, so each layer is a one-shot promise, and closing an inner layer can't return the outer one to the same selection;
  - (d) there's no shared selection value across rooms (`partRef` exists in `contract.ts`; there's no `setUi` bridge).
- Smallest version:
  - pass `plugins: [partsPlugin({ popup })]` into `openBlockSettings`;
  - allow `editSettings` in a nested mount;
  - make both layers push and pop on one host stack (the `openBlockPopup` handle already has `close`).

## 3. "See block settings" entry points

| Page kind | Where block settings are | Where look is | Words |
|---|---|---|---|
| Puck-first (katie, danamccool `/studio/[...path]`; sunjay `/studio/<slug>`; elktours) | Puck right column (fields) | Parts plugin panel ("← Block settings" back link, `page-builder/src/parts/panel.tsx:124`), or double-click for the popup | Puck rich-text fields; inline only in the popup |
| HE canvas-first (`/studio/<slug>` is canvas since 2026-11-11, Puck at `/studio/<slug>/blocks`) | Canvas right column (contract fields, `canvas/block-fields.ts`), plus **"Settings…"** button and right-click opening the Puck one-block popup | Canvas | Inline on the canvas |
| sunjay canvas (`/studio/<slug>/canvas`) | Contract fields, plus an **"Edit its settings" link** that leaves the page for Puck | Canvas | Inline |
| sunjay home `/` (in-place `openVisitorPage`) | Contract fields only. No link, no popup, no "From what?" | Canvas | Inline |
| Canvas block popup (any host) | **None.** Nested mounts drop both `editSettings` and the link | Popup | Inline |

**The inconsistency:**
- The same route means opposite things. `/studio/<slug>` is Puck on sunjay, elktours and innergathering, but the canvas on HE.
- sunjay's canvas isn't linked from `/manage/builder` (its rows link `/studio/<slug>`, `app/manage/builder/page.tsx:62,89`) or from the Site Builder hub card (`components/hub/hub-card-host.tsx:32` `puckEditHref → /studio/<path>`), so it's reachable only by typing the URL.
- One button does three different things: "Settings…" (popup), "Edit its settings" (navigate), or nothing at all.

## 4. sunjay manage vs the new manage/hub pattern

(Sonnet reader. Checked against the PLAN and the manage-ui doc.)

| Area | sunjay now | New pattern | Distance |
|---|---|---|---|
| Layout and nav | Hand-built Tailwind `TABS`/`OWNER_TABS`, no active state (`app/manage/layout.tsx:12-22`) | `ManageTabs` + `ToastProvider` sink (`packages/cms-ui/src/manage`). Reference adopter: HE `app/manage/layout.tsx` + `components/manage/manage-toasts.tsx` | S |
| Page list, site copy | `/manage/builder`, `/manage/pages` (`section-editor.tsx`) | Site Builder hub card, **already mounted** at `/hub`, `/hub/site` (commit `c50f354d`, pilot) | M: duplicates now; redirect them |
| People | `/manage/people` + `setMemberRoleAction` (`lib/cms/actions.ts:468`, the owner-grant bug) | Members card (`packages/hub/src/members`, live on ifac, arts-collective) | L |
| Content, compose | `/manage/content/*`, `/manage/compose` (a copy shared by 4 apps) | Org-site kit `[...kit]` (phase 4, sunjay first, from 11-25) | M; waits on `packages/org-site` (not started) |
| Gates | `requireOrgEditor` in the layout and in every page (`lib/auth.ts:67`) | Route-table `gate`, `HubGate` | S |
| Toasts | sonner direct | `useToast` with a `sink` | S |

Verdict: the shell is one step away; the content is waiting on the kit. `grep cms-ui/manage apps/sunjay/src` returns 0. The page builder is now in three places (`/manage/builder`, `/hub/site`, and `/studio`), and none of them reaches the canvas.

## 5. Direction (ordered)

1. **Pick one door per page and one URL grammar on every site.** Go canvas-first as HE did on 11-11: `/studio/<slug>` = house canvas, `/studio/<slug>/blocks` = Puck. On sunjay, wire `editSettings` → `openBlockSettings` (copy HE `CanvasEditor.tsx:130`) and point `/manage/builder` and `puckEditHref` at the canvas. App code only, no data change.
2. **Inception, minimal.** Plugins (parts and popup) inside `openBlockSettings`. Allow `editSettings` when `nested`. Put popup layers on one stack that hands the selection (`partRef`) back on close. Shared code in `page-builder` and `direct-edit`, so harness first (`frankenstein/drive-popup.cjs`).
3. **Route templates for spawned pages via the kit.** Build `defineRouteTemplate` (kit §2.1) with one `metadata.subject`. Give sunjay posts a `post-detail` template (ArticleView as the code default), and fold `detailPage`/`readDetailPage` into it. Add an "Edit this page's layout" entry on every spawned page that opens the template on that record.
4. **Make template saves safe** before more pages hang off them: a draft and publish pointer (`page_revisions`, following `lms_course_versions`), "Preview with <record>", and an `updated_at` conflict check. This needs a migration, so it needs Justin's go.
5. **sunjay manage → shell.** Copy HE's layout/toasts. Redirect `/manage/builder` and `/manage/pages` to `/hub/site`. Leave people and content for the Members card and the org-site kit phase 4.

## Correction (a2, 2026-11-14)
- §1 bottleneck 3 and the Custom page row were wrong. `lib/puck/render.tsx` draws "Edit this page" on every published Puck page, designed gathering pages included, and it links to the canvas. What is missing is the record: it opens `/studio/event-detail` on the next upcoming gathering, not the one you came from (ROUND1.md a2, open question 2).
